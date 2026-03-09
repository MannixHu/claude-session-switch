use semver::Version;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    #[serde(default)]
    assets: Vec<GithubReleaseAsset>,
}

#[derive(Debug, Deserialize)]
struct GithubReleaseAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub target_arch: String,
    pub asset_name: String,
    pub download_url: String,
    pub expected_sha256: String,
}

pub struct UpdateService;

impl UpdateService {
    fn normalize_version_tag(value: &str) -> Result<String, String> {
        let normalized = value.trim().trim_start_matches('v');
        if normalized.is_empty() {
            return Err("Version tag is empty".to_string());
        }

        Version::parse(normalized)
            .map_err(|error| format!("Invalid version tag {}: {}", value, error))?;

        Ok(normalized.to_string())
    }

    fn release_arch_suffix(arch: &str) -> Result<&'static str, String> {
        match arch.trim() {
            "aarch64" | "arm64" => Ok("arm64"),
            "x86_64" | "amd64" => Ok("x64"),
            other => Err(format!("Unsupported architecture: {}", other)),
        }
    }

    fn parse_checksums(content: &str) -> Vec<(String, String)> {
        content
            .lines()
            .filter_map(|line| {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    return None;
                }

                let mut parts = trimmed.split_whitespace();
                let digest = parts.next()?.trim().to_lowercase();
                let file_name = parts.next()?.trim().to_string();

                Some((file_name, digest))
            })
            .collect()
    }

    pub fn resolve_release(
        current_version: &str,
        arch: &str,
        release_json: &str,
        checksums: &str,
    ) -> Result<UpdateCheckResult, String> {
        let normalized_current = Self::normalize_version_tag(current_version)?;
        let release: GithubRelease = serde_json::from_str(release_json)
            .map_err(|error| format!("Failed to parse latest release payload: {}", error))?;
        let normalized_latest = Self::normalize_version_tag(&release.tag_name)?;

        let current = Version::parse(&normalized_current)
            .map_err(|error| format!("Invalid current version {}: {}", normalized_current, error))?;
        let latest = Version::parse(&normalized_latest)
            .map_err(|error| format!("Invalid latest version {}: {}", normalized_latest, error))?;

        let target_arch = Self::release_arch_suffix(arch)?.to_string();

        if latest <= current {
            return Ok(UpdateCheckResult {
                current_version: normalized_current,
                latest_version: normalized_latest,
                update_available: false,
                target_arch,
                asset_name: String::new(),
                download_url: String::new(),
                expected_sha256: String::new(),
            });
        }

        let expected_asset_name =
            format!("ClaudeSessionSwitch_{}_{}.dmg", normalized_latest, target_arch);

        let asset = release
            .assets
            .iter()
            .find(|asset| asset.name == expected_asset_name)
            .ok_or_else(|| {
                format!(
                    "Latest release is missing the {} installer for {}",
                    target_arch, normalized_latest
                )
            })?;

        let expected_sha256 = Self::parse_checksums(checksums)
            .into_iter()
            .find_map(|(file_name, digest)| {
                if file_name == expected_asset_name {
                    Some(digest)
                } else {
                    None
                }
            })
            .ok_or_else(|| format!("Missing checksum for {}", expected_asset_name))?;

        Ok(UpdateCheckResult {
            current_version: normalized_current,
            latest_version: normalized_latest,
            update_available: true,
            target_arch,
            asset_name: expected_asset_name,
            download_url: asset.browser_download_url.clone(),
            expected_sha256,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateService;

    #[test]
    fn latest_release_selects_arm64_asset_and_checksum() {
        let release_json = r#"{
          "tag_name": "v0.1.17",
          "assets": [
            {
              "name": "ClaudeSessionSwitch_0.1.17_arm64.dmg",
              "browser_download_url": "https://example.com/arm64.dmg"
            },
            {
              "name": "ClaudeSessionSwitch_0.1.17_x64.dmg",
              "browser_download_url": "https://example.com/x64.dmg"
            },
            {
              "name": "SHA256SUMS",
              "browser_download_url": "https://example.com/SHA256SUMS"
            }
          ]
        }"#;
        let checksums = "abc123  ClaudeSessionSwitch_0.1.17_arm64.dmg\nfff999  ClaudeSessionSwitch_0.1.17_x64.dmg\n";

        let result =
            UpdateService::resolve_release("0.1.16", "aarch64", release_json, checksums)
                .unwrap();

        assert!(result.update_available);
        assert_eq!(result.current_version, "0.1.16");
        assert_eq!(result.latest_version, "0.1.17");
        assert_eq!(result.asset_name, "ClaudeSessionSwitch_0.1.17_arm64.dmg");
        assert_eq!(result.expected_sha256, "abc123");
    }

    #[test]
    fn latest_release_returns_up_to_date_when_versions_match() {
        let release_json = r#"{
          "tag_name": "v0.1.16",
          "assets": []
        }"#;

        let result = UpdateService::resolve_release("0.1.16", "aarch64", release_json, "")
            .unwrap();

        assert!(!result.update_available);
        assert_eq!(result.latest_version, "0.1.16");
    }

    #[test]
    fn latest_release_rejects_missing_arch_asset() {
        let release_json = r#"{
          "tag_name": "v0.1.17",
          "assets": [
            {
              "name": "ClaudeSessionSwitch_0.1.17_x64.dmg",
              "browser_download_url": "https://example.com/x64.dmg"
            },
            {
              "name": "SHA256SUMS",
              "browser_download_url": "https://example.com/SHA256SUMS"
            }
          ]
        }"#;

        let error = UpdateService::resolve_release(
            "0.1.16",
            "aarch64",
            release_json,
            "fff999  ClaudeSessionSwitch_0.1.17_x64.dmg\n",
        )
        .unwrap_err();

        assert!(error.contains("arm64"));
    }
}
