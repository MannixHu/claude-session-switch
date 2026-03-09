import test from "node:test";
import assert from "node:assert/strict";
import { getClaudeAutoResponseForOutput } from "./claudeTerminalAutomation.ts";

test("getClaudeAutoResponseForOutput confirms workspace trust prompt", () => {
  const output = `\u001b[?2026h\r
────────────────────────────────────────────────────────────────────────────────\r
\u001b[1CAccessing\u001b[1Cworkspace:\r
\r
\u001b[1C/Users/mannix\r
\r
\u001b[1CQuick\u001b[1Csafety\u001b[1Ccheck:\u001b[1CIs\u001b[1Cthis\u001b[1Ca\u001b[1Cproject\u001b[1Cyou\u001b[1Ccreated\u001b[1Cor\u001b[1Cone\u001b[1Cyou\u001b[1Ctrust?\r
\u001b[1CClaude\u001b[1CCode'll\u001b[1Cbe\u001b[1Cable\u001b[1Cto\u001b[1Cread,\u001b[1Cedit,\u001b[1Cand\u001b[1Cexecute\u001b[1Cfiles\u001b[1Chere.\r
\r
\u001b[1C❯\u001b[1C1.\u001b[1CYes,\u001b[1CI\u001b[1Ctrust\u001b[1Cthis\u001b[1Cfolder\r
\u001b[3C2.\u001b[1CNo,\u001b[1Cexit\r
\r
\u001b[1CEnter\u001b[1Cto\u001b[1Cconfirm\u001b[1C·\u001b[1CEsc\u001b[1Cto\u001b[1Ccancel\r`;

  assert.equal(getClaudeAutoResponseForOutput(output), "\r");
});

test("getClaudeAutoResponseForOutput ignores normal claude prompt", () => {
  const output = `Claude Code v2.1.71\nOpus 4.6 with high effort\n❯ `;

  assert.equal(getClaudeAutoResponseForOutput(output), null);
});

test("getClaudeAutoResponseForOutput ignores partial safety prompt", () => {
  const output = `Accessing workspace:\n/Users/mannix\nQuick safety check: Is this a project you created or one you trust?`;

  assert.equal(getClaudeAutoResponseForOutput(output), null);
});
