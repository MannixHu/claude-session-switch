const ANSI_SEQUENCE_PATTERN = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

const WORKSPACE_TRUST_PATTERNS = [
  /Accessing workspace:/i,
  /Quick safety check: Is this a project you created or one you trust\?/i,
  /1\.\s*Yes,\s*I trust this folder/i,
  /Enter to confirm/i,
] as const;

export function normalizeClaudeTerminalOutputForMatching(output: string): string {
  return output
    .replace(ANSI_SEQUENCE_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getClaudeAutoResponseForOutput(output: string): string | null {
  const normalized = normalizeClaudeTerminalOutputForMatching(output);
  if (!normalized) {
    return null;
  }

  const isWorkspaceTrustPrompt = WORKSPACE_TRUST_PATTERNS.every((pattern) =>
    pattern.test(normalized)
  );

  if (isWorkspaceTrustPrompt) {
    return "\r";
  }

  return null;
}
