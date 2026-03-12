import test from "node:test";
import assert from "node:assert/strict";
import {
  applyUpdateCheckResult,
  applyUpdateError,
  beginUpdateCheck,
  beginUpdateDownload,
  createIdleUpdateState,
} from "./updateFlow.ts";

test("beginUpdateCheck ignores duplicate triggers while busy", () => {
  const busyState = {
    ...createIdleUpdateState(),
    phase: "checking" as const,
  };

  const next = beginUpdateCheck(busyState);

  assert.equal(next, busyState);
});

test("applyUpdateCheckResult returns available phase when newer version exists", () => {
  const next = applyUpdateCheckResult(createIdleUpdateState(), {
    current_version: "0.1.16",
    latest_version: "0.1.17",
    update_available: true,
    release_url: "https://example.com/releases/v0.1.17",
    release_notes: "## Changelog",
    published_at: "2026-03-12T08:15:00Z",
    target_arch: "arm64",
    asset_name: "ClaudeSessionSwitch_0.1.17_arm64.dmg",
    download_url: "https://example.com/arm64.dmg",
    expected_sha256: "abc123",
  });

  assert.equal(next.phase, "available");
  assert.equal(next.metadata?.latest_version, "0.1.17");
});

test("applyUpdateCheckResult returns up_to_date when no update is available", () => {
  const next = applyUpdateCheckResult(createIdleUpdateState(), {
    current_version: "0.1.16",
    latest_version: "0.1.16",
    update_available: false,
    release_url: "https://example.com/releases/v0.1.16",
    release_notes: "already current",
    published_at: "2026-03-12T08:15:00Z",
    target_arch: "arm64",
    asset_name: "",
    download_url: "",
    expected_sha256: "",
  });

  assert.equal(next.phase, "up_to_date");
  assert.equal(next.metadata?.latest_version, "0.1.16");
});

test("beginUpdateDownload moves available state into downloading", () => {
  const available = applyUpdateCheckResult(createIdleUpdateState(), {
    current_version: "0.1.16",
    latest_version: "0.1.17",
    update_available: true,
    release_url: "https://example.com/releases/v0.1.17",
    release_notes: "## Changelog",
    published_at: "2026-03-12T08:15:00Z",
    target_arch: "arm64",
    asset_name: "ClaudeSessionSwitch_0.1.17_arm64.dmg",
    download_url: "https://example.com/arm64.dmg",
    expected_sha256: "abc123",
  });

  const next = beginUpdateDownload(available);

  assert.equal(next.phase, "downloading");
  assert.equal(next.metadata?.asset_name, "ClaudeSessionSwitch_0.1.17_arm64.dmg");
});

test("beginUpdateDownload ignores duplicate triggers while already downloading", () => {
  const downloading = {
    ...applyUpdateCheckResult(createIdleUpdateState(), {
      current_version: "0.1.16",
      latest_version: "0.1.17",
      update_available: true,
      release_url: "https://example.com/releases/v0.1.17",
      release_notes: "## Changelog",
      published_at: "2026-03-12T08:15:00Z",
      target_arch: "arm64",
      asset_name: "ClaudeSessionSwitch_0.1.17_arm64.dmg",
      download_url: "https://example.com/arm64.dmg",
      expected_sha256: "abc123",
    }),
    phase: "downloading" as const,
  };

  const next = beginUpdateDownload(downloading);

  assert.equal(next, downloading);
});

test("beginUpdateDownload retries from an error state when metadata is still present", () => {
  const errored = {
    ...applyUpdateCheckResult(createIdleUpdateState(), {
      current_version: "0.1.16",
      latest_version: "0.1.17",
      update_available: true,
      release_url: "https://example.com/releases/v0.1.17",
      release_notes: "## Changelog",
      published_at: "2026-03-12T08:15:00Z",
      target_arch: "arm64",
      asset_name: "ClaudeSessionSwitch_0.1.17_arm64.dmg",
      download_url: "https://example.com/arm64.dmg",
      expected_sha256: "abc123",
    }),
    phase: "error" as const,
    error: "network failed",
  };

  const next = beginUpdateDownload(errored);

  assert.equal(next.phase, "downloading");
  assert.equal(next.error, "");
  assert.equal(next.metadata?.asset_name, "ClaudeSessionSwitch_0.1.17_arm64.dmg");
});

test("applyUpdateCheckResult keeps metadata for the up_to_date dialog state", () => {
  const next = applyUpdateCheckResult(createIdleUpdateState(), {
    current_version: "0.1.18",
    latest_version: "0.1.18",
    update_available: false,
    release_url: "https://example.com/releases/v0.1.18",
    release_notes: "latest release notes",
    published_at: "2026-03-12T08:15:00Z",
    target_arch: "arm64",
    asset_name: "",
    download_url: "",
    expected_sha256: "",
  });

  assert.equal(next.phase, "up_to_date");
  assert.equal(next.metadata?.release_notes, "latest release notes");
});

test("applyUpdateError records error phase and message", () => {
  const next = applyUpdateError(createIdleUpdateState(), "network failed");

  assert.equal(next.phase, "error");
  assert.equal(next.error, "network failed");
});
