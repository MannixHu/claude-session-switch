import type { ClaudeSession, Project } from "../hooks/useBackend";

type SessionAliasTarget = Pick<ClaudeSession, "project_path" | "session_id">;
type SessionLabelSource = Pick<ClaudeSession, "summary" | "first_prompt" | "session_id">;
type SessionHiddenState = Record<string, boolean>;

export type SessionAliasUpdateResult = {
  aliases: Record<string, string>;
  alias: string | null;
  status: "updated" | "cleared" | "unchanged";
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
  if (session.summary.trim().length > 0) {
    return session.summary;
  }

  if (session.first_prompt.trim().length > 0) {
    return session.first_prompt;
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
