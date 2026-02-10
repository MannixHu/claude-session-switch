#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  capture-app-window.sh [APP_NAME] [OUTPUT_PATH]
  capture-app-window.sh --list

Examples:
  capture-app-window.sh "Claude Session Manager" /tmp/ccsm.png
  capture-app-window.sh Terminal
  capture-app-window.sh --list
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v screencapture >/dev/null 2>&1; then
  echo "[error] 'screencapture' not found (macOS required)." >&2
  exit 1
fi

if ! command -v swift >/dev/null 2>&1; then
  echo "[error] 'swift' not found (required to inspect macOS windows)." >&2
  exit 1
fi

list_windows() {
  swift - <<'SWIFT'
import Foundation
import CoreGraphics

let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
guard let raw = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
  fputs("ERROR\n", stderr)
  exit(2)
}

struct Row {
  let owner: String
  let title: String
  let id: UInt32
  let x: Int
  let y: Int
  let w: Int
  let h: Int
  let layer: Int
  let area: Double
}

var rows: [Row] = []

for info in raw {
  let owner = (info[kCGWindowOwnerName as String] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
  if owner.isEmpty { continue }

  let layer = info[kCGWindowLayer as String] as? Int ?? 0
  if layer != 0 { continue }

  let alpha = info[kCGWindowAlpha as String] as? Double ?? 1
  if alpha < 0.05 { continue }

  guard
    let boundsObject = info[kCGWindowBounds as String] as? NSDictionary,
    let rect = CGRect(dictionaryRepresentation: boundsObject)
  else { continue }

  if rect.width < 120 || rect.height < 90 { continue }

  let id = info[kCGWindowNumber as String] as? UInt32 ?? 0
  let title = (info[kCGWindowName as String] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

  rows.append(
    Row(
      owner: owner,
      title: title,
      id: id,
      x: Int(rect.origin.x),
      y: Int(rect.origin.y),
      w: Int(rect.size.width),
      h: Int(rect.size.height),
      layer: layer,
      area: rect.size.width * rect.size.height
    )
  )
}

rows.sort { lhs, rhs in
  if lhs.area != rhs.area { return lhs.area > rhs.area }
  return lhs.id > rhs.id
}

for row in rows.prefix(25) {
  print("\(row.owner)\t\(row.id)\t\(row.x)\t\(row.y)\t\(row.w)\t\(row.h)\t\(row.title)")
}
SWIFT
}

find_window_for_app() {
  local app_name="$1"

  swift - "$app_name" <<'SWIFT'
import Foundation
import CoreGraphics

let appName = CommandLine.arguments[1].trimmingCharacters(in: .whitespacesAndNewlines)
if appName.isEmpty {
  fputs("NONE\tApp name is empty\n", stderr)
  exit(3)
}

let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
guard let raw = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
  fputs("NONE\tUnable to read window list\n", stderr)
  exit(4)
}

struct Candidate {
  let owner: String
  let title: String
  let id: UInt32
  let x: Int
  let y: Int
  let w: Int
  let h: Int
  let area: Double
}

var candidates: [Candidate] = []
var owners = Set<String>()

for info in raw {
  let owner = (info[kCGWindowOwnerName as String] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
  if owner.isEmpty { continue }

  owners.insert(owner)

  if owner.caseInsensitiveCompare(appName) != .orderedSame { continue }

  let layer = info[kCGWindowLayer as String] as? Int ?? 0
  if layer != 0 { continue }

  let alpha = info[kCGWindowAlpha as String] as? Double ?? 1
  if alpha < 0.05 { continue }

  guard
    let boundsObject = info[kCGWindowBounds as String] as? NSDictionary,
    let rect = CGRect(dictionaryRepresentation: boundsObject)
  else { continue }

  if rect.width < 120 || rect.height < 90 { continue }

  let id = info[kCGWindowNumber as String] as? UInt32 ?? 0
  let title = (info[kCGWindowName as String] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

  candidates.append(
    Candidate(
      owner: owner,
      title: title,
      id: id,
      x: Int(rect.origin.x),
      y: Int(rect.origin.y),
      w: Int(rect.size.width),
      h: Int(rect.size.height),
      area: rect.size.width * rect.size.height
    )
  )
}

if candidates.isEmpty {
  let ownerHint = owners
    .sorted()
    .prefix(18)
    .joined(separator: ", ")
  print("NONE\t\(ownerHint)")
  exit(5)
}

candidates.sort { lhs, rhs in
  if lhs.area != rhs.area { return lhs.area > rhs.area }
  return lhs.id > rhs.id
}

let best = candidates[0]
print("\(best.id)\t\(best.x)\t\(best.y)\t\(best.w)\t\(best.h)\t\(best.owner)\t\(best.title)")
SWIFT
}

if [[ "${1:-}" == "--list" ]]; then
  list_windows
  exit 0
fi

APP_NAME="${1:-Claude Session Manager}"
OUTPUT_PATH="${2:-$PWD/tmp/ccsm-window-$(date +%Y%m%d-%H%M%S).png}"
mkdir -p "$(dirname "$OUTPUT_PATH")"

WINDOW_LINE="$(find_window_for_app "$APP_NAME" || true)"
if [[ -z "$WINDOW_LINE" || "$WINDOW_LINE" == NONE$'\t'* ]]; then
  HINT="${WINDOW_LINE#NONE$'\t'}"
  echo "[error] No on-screen window found for app: '$APP_NAME'." >&2
  if [[ -n "$HINT" ]]; then
    echo "[hint] Current visible app owners include: $HINT" >&2
  fi
  echo "[hint] Ensure app window is visible and not minimized." >&2
  exit 1
fi

IFS=$'\t' read -r WINDOW_ID X Y W H OWNER TITLE <<< "$WINDOW_LINE"

if [[ -z "$WINDOW_ID" ]]; then
  echo "[error] Failed to resolve window id for '$APP_NAME'." >&2
  exit 1
fi

capture_log="$(mktemp -t ccsm-capture.XXXXXX.log)"

if ! screencapture -x -o -l "$WINDOW_ID" "$OUTPUT_PATH" 2>"$capture_log"; then
  if [[ -n "${X:-}" && -n "${Y:-}" && -n "${W:-}" && -n "${H:-}" ]]; then
    if ! screencapture -x -o -R "${X},${Y},${W},${H}" "$OUTPUT_PATH" 2>>"$capture_log"; then
      echo "[error] Failed to capture app window for '$APP_NAME' (id=$WINDOW_ID)." >&2
      if [[ -s "$capture_log" ]]; then
        echo "[detail] $(tr '
' ' ' < "$capture_log" | sed 's/  */ /g')" >&2
      fi
      echo "[hint] Grant Screen Recording permission to Terminal and retry." >&2
      echo "[hint] macOS: System Settings -> Privacy & Security -> Screen Recording" >&2
      rm -f "$capture_log"
      exit 1
    fi
  else
    echo "[error] Failed to capture window id=$WINDOW_ID and no valid bounds fallback." >&2
    if [[ -s "$capture_log" ]]; then
      echo "[detail] $(tr '
' ' ' < "$capture_log" | sed 's/  */ /g')" >&2
    fi
    rm -f "$capture_log"
    exit 1
  fi
fi

rm -f "$capture_log"

if [[ ! -s "$OUTPUT_PATH" ]]; then
  echo "[error] Capture produced an empty image: $OUTPUT_PATH" >&2
  echo "[hint] Grant Screen Recording permission to Terminal in macOS Settings." >&2
  exit 1
fi

echo "$OUTPUT_PATH"
