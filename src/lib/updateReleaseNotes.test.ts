import test from "node:test";
import assert from "node:assert/strict";
import {
  parseUpdateReleaseNotes,
  formatPublishedDate,
} from "./updateReleaseNotes.ts";

test("parseUpdateReleaseNotes extracts changelog rows and summary notes", () => {
  const parsed = parseUpdateReleaseNotes(`## Changelog

| Commit | Description |
| --- | --- |
| \`abc123\` | feat: add update dialog |
| \`def456\` | fix: polish update copy |

## Notes

- Adds a dedicated update modal
- Shows release details in-app
`);

  assert.deepEqual(parsed.changelogRows, [
    { commit: "abc123", description: "feat: add update dialog" },
    { commit: "def456", description: "fix: polish update copy" },
  ]);
  assert.equal(parsed.summaryNotes.includes("## Notes"), true);
  assert.equal(parsed.summaryNotes.includes("Adds a dedicated update modal"), true);
});

test("parseUpdateReleaseNotes preserves body when no changelog table exists", () => {
  const parsed = parseUpdateReleaseNotes("Bug fixes and small improvements.");

  assert.deepEqual(parsed.changelogRows, []);
  assert.equal(parsed.summaryNotes, "Bug fixes and small improvements.");
});

test("formatPublishedDate returns a stable local date string for valid timestamps", () => {
  const formatted = formatPublishedDate("2026-03-12T08:15:00Z", "zh-CN");

  assert.equal(typeof formatted, "string");
  assert.equal(formatted.length > 0, true);
});

test("parseUpdateReleaseNotes preserves notes that appear before the changelog table", () => {
  const parsed = parseUpdateReleaseNotes(`## Highlights

This release adds a richer updater dialog.

## Changelog

| Commit | Description |
| --- | --- |
| \`abc123\` | feat: add updater |

## Notes

Manual installer flow remains unchanged.
`);

  assert.deepEqual(parsed.changelogRows, [{ commit: "abc123", description: "feat: add updater" }]);
  assert.equal(parsed.summaryNotes.includes("## Highlights"), true);
  assert.equal(parsed.summaryNotes.includes("richer updater dialog"), true);
  assert.equal(parsed.summaryNotes.includes("## Notes"), true);
});

test("parseUpdateReleaseNotes keeps escaped pipes inside changelog descriptions", () => {
  const parsed = parseUpdateReleaseNotes(`## Changelog

| Commit | Description |
| --- | --- |
| \`abc123\` | feat: allow a\\|b values |
`);

  assert.deepEqual(parsed.changelogRows, [
    {
      commit: "abc123",
      description: "feat: allow a|b values",
    },
  ]);
});
