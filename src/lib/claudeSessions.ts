import type { ClaudeSession, Project } from "../hooks/useBackend";

type SessionAliasTarget = Pick<ClaudeSession, "project_path" | "session_id">;
type SessionLabelSource = Pick<ClaudeSession, "summary" | "first_prompt" | "session_id">;
type SessionHiddenState = Record<string, boolean>;

export type SessionAliasUpdateResult = {
  aliases: Record<string, string>;
  alias: string | null;
  status: "updated" | "cleared" | "unchanged";
};

const SESSION_HISTORY_SUMMARY_LINE =
  /^\(This is a summary of earlier conversation turns for context\./i;
const SESSION_TOOL_NOTE_LINE = /Tool calls shown here were already executed/i;

const extractTextFromStructuredValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => extractTextFromStructuredValue(item))
      .filter((item) => item.trim().length > 0)
      .join("\n");
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;

  if (typeof record.text === "string" && record.text.trim().length > 0) {
    return record.text;
  }

  for (const key of ["content", "title", "label", "summary", "prompt"] as const) {
    const extracted = extractTextFromStructuredValue(record[key]);
    if (extracted.trim().length > 0) {
      return extracted;
    }
  }

  return Object.values(record)
    .map((item) => extractTextFromStructuredValue(item))
    .filter((item) => item.trim().length > 0)
    .join("\n");
};

const tryExtractStructuredSessionText = (value: string): string => {
  const trimmed = value.trim();
  if (!(trimmed.startsWith("[") || trimmed.startsWith("{"))) {
    return value;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const extracted = extractTextFromStructuredValue(parsed).trim();
    return extracted || value;
  } catch {
    try {
      const parsed = JSON.parse(trimmed.replace(/\r\n?|\n/g, "\\n")) as unknown;
      const extracted = extractTextFromStructuredValue(parsed).trim();
      return extracted || value;
    } catch {
      return value;
    }
  }
};

const stripHtmlComments = (value: string): string => {
  return value.replace(/<!--[\s\S]*?-->/g, " ");
};

const replaceConversationTagBlock = (
  value: string,
  tagName: "conversation_history" | "conversation_summary"
): string => {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "gi");

  return value.replace(pattern, (match, inner: string, offset: number, source: string) => {
    const suffix = source.slice(offset + match.length).trim();
    if (suffix.length > 0) {
      return "\n";
    }

    return tagName === "conversation_summary" ? inner : "";
  });
};

const cleanupSessionLabelText = (value: string): string => {
  const extracted = tryExtractStructuredSessionText(value);
  const normalized = stripHtmlComments(extracted).replace(/\r\n?/g, "\n").trim();
  const withoutHistory = replaceConversationTagBlock(normalized, "conversation_history");
  const withoutSummary = replaceConversationTagBlock(withoutHistory, "conversation_summary");

  const lines = withoutSummary
    .split("\n")
    .map((line) => line.replace(/^(Human|Assistant):\s*/i, ""))
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^<[^>]+>$/.test(line))
    .filter((line) => !SESSION_HISTORY_SUMMARY_LINE.test(line))
    .filter((line) => !SESSION_TOOL_NOTE_LINE.test(line));

  return lines[0] ?? "";
};

const normalizeAliasProjectPath = (projectPath: string): string => {
  return projectPath
    .replace(/\\/g, "/")
    .replace(/\/+$/, "")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeSessionAlias = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

export function buildSessionAliasKey(projectPath: string, sessionId: string): string {
  const normalizedProjectPath = normalizeAliasProjectPath(projectPath);
  const normalizedSessionId = normalizeSessionAlias(sessionId);

  return `${encodeURIComponent(normalizedProjectPath)}::${encodeURIComponent(normalizedSessionId)}`;
}

export function getDefaultSessionLabel(session: SessionLabelSource): string {
  const summary = cleanupSessionLabelText(session.summary);
  if (summary.length > 0) {
    return summary;
  }

  const firstPrompt = cleanupSessionLabelText(session.first_prompt);
  if (firstPrompt.length > 0) {
    return firstPrompt;
  }

  return session.session_id.slice(0, 8);
}

export function getSessionAliasForItem(
  aliases: Record<string, string>,
  session: SessionAliasTarget
): string | null {
  const namespacedKey = buildSessionAliasKey(session.project_path, session.session_id);
  const namespacedAlias = aliases[namespacedKey];
  if (typeof namespacedAlias === "string" && namespacedAlias.trim().length > 0) {
    return namespacedAlias;
  }

  const legacyAlias = aliases[session.session_id];
  if (typeof legacyAlias === "string" && legacyAlias.trim().length > 0) {
    return legacyAlias;
  }

  return null;
}

export function removeSessionAliasEntries(
  aliases: Record<string, string>,
  session: SessionAliasTarget
): Record<string, string> {
  let changed = false;
  const next = { ...aliases };

  const namespacedKey = buildSessionAliasKey(session.project_path, session.session_id);
  if (namespacedKey in next) {
    delete next[namespacedKey];
    changed = true;
  }

  if (session.session_id in next) {
    delete next[session.session_id];
    changed = true;
  }

  return changed ? next : aliases;
}

export function updateSessionAliasesForDraft(
  aliases: Record<string, string>,
  session: ClaudeSession,
  draft: string
): SessionAliasUpdateResult {
  const normalizedAlias = normalizeSessionAlias(draft);
  const defaultLabel = getDefaultSessionLabel(session);
  const baseAliases = removeSessionAliasEntries(aliases, session);

  if (!normalizedAlias || normalizedAlias === defaultLabel) {
    return {
      aliases: baseAliases,
      alias: null,
      status: baseAliases === aliases ? "unchanged" : "cleared",
    };
  }

  const namespacedKey = buildSessionAliasKey(session.project_path, session.session_id);
  const aliasAlreadySet =
    baseAliases === aliases &&
    namespacedKey in baseAliases &&
    baseAliases[namespacedKey] === normalizedAlias;

  if (aliasAlreadySet) {
    return {
      aliases,
      alias: normalizedAlias,
      status: "unchanged",
    };
  }

  return {
    aliases: {
      ...baseAliases,
      [namespacedKey]: normalizedAlias,
    },
    alias: normalizedAlias,
    status: "updated",
  };
}

export function isClaudeSessionHidden(
  hiddenSessions: SessionHiddenState,
  session: SessionAliasTarget
): boolean {
  const namespacedKey = buildSessionAliasKey(session.project_path, session.session_id);
  if (hiddenSessions[namespacedKey] === true) {
    return true;
  }

  return hiddenSessions[session.session_id] === true;
}

export function hideClaudeSession(
  hiddenSessions: SessionHiddenState,
  session: SessionAliasTarget
): SessionHiddenState {
  const baseState = removeHiddenClaudeSession(hiddenSessions, session);
  const namespacedKey = buildSessionAliasKey(session.project_path, session.session_id);

  if (baseState[namespacedKey] === true) {
    return baseState;
  }

  return {
    ...baseState,
    [namespacedKey]: true,
  };
}

export function removeHiddenClaudeSession(
  hiddenSessions: SessionHiddenState,
  session: SessionAliasTarget
): SessionHiddenState {
  let changed = false;
  const next = { ...hiddenSessions };

  const namespacedKey = buildSessionAliasKey(session.project_path, session.session_id);
  if (namespacedKey in next) {
    delete next[namespacedKey];
    changed = true;
  }

  if (session.session_id in next) {
    delete next[session.session_id];
    changed = true;
  }

  return changed ? next : hiddenSessions;
}

export function getVisibleClaudeSessions(
  sessions: ClaudeSession[],
  hiddenSessions: SessionHiddenState = {}
): ClaudeSession[] {
  return sessions.filter((session) => {
    if (session.session_id.trim().length === 0) {
      return false;
    }

    if (isClaudeSessionHidden(hiddenSessions, session)) {
      return false;
    }

    return (
      session.summary.trim().length > 0 ||
      session.first_prompt.trim().length > 0 ||
      session.message_count > 0
    );
  });
}

export function getProjectsWithOpenPlainTerminals(
  projects: Project[],
  openTerminalSessionIds: Set<string>
): Project[] {
  return projects.filter((project) => openTerminalSessionIds.has(`__plain__${project.id}`));
}

export function haveClaudeSessionsChanged(
  previous: ClaudeSession[],
  next: ClaudeSession[]
): boolean {
  if (previous.length !== next.length) {
    return true;
  }

  return previous.some((session, index) => {
    const nextSession = next[index];
    if (!nextSession) {
      return true;
    }

    return (
      session.session_id !== nextSession.session_id ||
      session.summary !== nextSession.summary ||
      session.first_prompt !== nextSession.first_prompt ||
      session.modified !== nextSession.modified ||
      session.message_count !== nextSession.message_count
    );
  });
}
