import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSessionAliasKey,
  getProjectsWithOpenPlainTerminals,
  getSessionAliasForItem,
  getVisibleClaudeSessions,
  hideClaudeSession,
  haveClaudeSessionsChanged,
  removeHiddenClaudeSession,
  updateSessionAliasesForDraft,
} from "./claudeSessions.ts";
import type { ClaudeSession, Project } from "../hooks/useBackend";

function project(id: string): Project {
  return {
    id,
    name: `Project ${id}`,
    description: "",
    path: `/tmp/${id}`,
    color: "#3B82F6",
    is_favorited: false,
    session_ids: [],
    created_at: "",
    updated_at: "",
  };
}

function session(overrides: Partial<ClaudeSession> = {}): ClaudeSession {
  return {
    session_id: "session-1",
    project_path: "/tmp/project-1",
    summary: "",
    first_prompt: "",
    message_count: 0,
    created: "",
    modified: "",
    git_branch: "",
    is_sidechain: false,
    ...overrides,
  };
}

test("getVisibleClaudeSessions hides empty progress-only sessions", () => {
  const result = getVisibleClaudeSessions([session()]);

  assert.equal(result.length, 0);
});

test("getVisibleClaudeSessions keeps contentful sessions without summary", () => {
  const result = getVisibleClaudeSessions([session({ message_count: 2 })]);

  assert.equal(result.length, 1);
  assert.equal(result[0].session_id, "session-1");
});

test("getVisibleClaudeSessions hides locally hidden sessions", () => {
  const item = session({
    session_id: "session-hidden",
    project_path: "/tmp/project-hidden",
    message_count: 2,
  });

  const hidden = {
    [buildSessionAliasKey(item.project_path, item.session_id)]: true,
  };

  const result = getVisibleClaudeSessions([item], hidden);

  assert.equal(result.length, 0);
});

test("getProjectsWithOpenPlainTerminals returns projects with plain terminals", () => {
  const result = getProjectsWithOpenPlainTerminals(
    [project("one"), project("two")],
    new Set(["__plain__two"])
  );

  assert.deepEqual(
    result.map((item) => item.id),
    ["two"]
  );
});

test("haveClaudeSessionsChanged detects newly discovered sessions", () => {
  const previous = [session({ session_id: "existing" })];
  const next = [session({ session_id: "existing" }), session({ session_id: "new-session" })];

  assert.equal(haveClaudeSessionsChanged(previous, next), true);
});

test("getSessionAliasForItem prefers namespaced alias over legacy alias", () => {
  const item = session({
    session_id: "session-42",
    project_path: "/tmp/project-alias",
  });

  const result = getSessionAliasForItem(
    {
      "session-42": "Legacy alias",
      [buildSessionAliasKey(item.project_path, item.session_id)]: "Review handoff",
    },
    item
  );

  assert.equal(result, "Review handoff");
});

test("updateSessionAliasesForDraft stores a normalized namespaced alias", () => {
  const item = session({
    session_id: "session-42",
    project_path: "/tmp/project-alias",
    summary: "Original title",
  });

  const result = updateSessionAliasesForDraft(
    {
      "session-42": "Legacy alias",
    },
    item,
    "  Review    handoff   "
  );

  assert.equal(result.status, "updated");
  assert.equal(result.alias, "Review handoff");
  assert.deepEqual(result.aliases, {
    [buildSessionAliasKey(item.project_path, item.session_id)]: "Review handoff",
  });
});

test("updateSessionAliasesForDraft clears alias when draft is empty", () => {
  const item = session({
    session_id: "session-42",
    project_path: "/tmp/project-alias",
    summary: "Original title",
  });

  const result = updateSessionAliasesForDraft(
    {
      [buildSessionAliasKey(item.project_path, item.session_id)]: "Review handoff",
    },
    item,
    "   "
  );

  assert.equal(result.status, "cleared");
  assert.equal(result.alias, null);
  assert.deepEqual(result.aliases, {});
});

test("updateSessionAliasesForDraft clears alias when draft matches default label", () => {
  const item = session({
    session_id: "session-42",
    project_path: "/tmp/project-alias",
    summary: "Original title",
  });

  const result = updateSessionAliasesForDraft(
    {
      [buildSessionAliasKey(item.project_path, item.session_id)]: "Review handoff",
    },
    item,
    "Original   title"
  );

  assert.equal(result.status, "cleared");
  assert.equal(result.alias, null);
  assert.deepEqual(result.aliases, {});
});

test("hideClaudeSession stores a namespaced hidden marker", () => {
  const item = session({
    session_id: "session-42",
    project_path: "/tmp/project-hidden",
  });

  const result = hideClaudeSession({}, item);

  assert.deepEqual(result, {
    [buildSessionAliasKey(item.project_path, item.session_id)]: true,
  });
});

test("removeHiddenClaudeSession clears hidden marker for a session", () => {
  const item = session({
    session_id: "session-42",
    project_path: "/tmp/project-hidden",
  });

  const result = removeHiddenClaudeSession(
    {
      [buildSessionAliasKey(item.project_path, item.session_id)]: true,
    },
    item
  );

  assert.deepEqual(result, {});
});
