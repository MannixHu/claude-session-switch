import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { LogicalSize, getCurrentWindow } from "@tauri-apps/api/window";
import {
  Project,
  ClaudeSession,
  DownloadedUpdateResult,
  useBackend,
} from "../hooks/useBackend";
import { LayoutState, useWindowManager } from "../hooks/useWindowManager";
import EmbeddedTerminal from "../components/EmbeddedTerminal";
import UpdateDialog from "../components/UpdateDialog";
import {
  AppLanguage,
  DEFAULT_APP_LANGUAGE,
  createTranslator,
  resolveAppLanguage,
} from "../lib/i18n";
import {
  buildSessionAliasKey,
  getDefaultSessionLabel,
  getProjectsWithOpenPlainTerminals,
  getSessionAliasForItem,
  getVisibleClaudeSessions,
  hideClaudeSession,
  haveClaudeSessionsChanged,
  removeHiddenClaudeSession,
  removeSessionAliasEntries,
  updateSessionAliasesForDraft,
} from "../lib/claudeSessions";
import { getClaudeAutoResponseForOutput } from "../lib/claudeTerminalAutomation";
import {
  applyUpdateCheckResult,
  applyUpdateError,
  applyUpdateSuccess,
  beginUpdateCheck,
  beginUpdateDownload,
  createIdleUpdateState,
} from "../lib/updateFlow";
import { formatPublishedDate, parseUpdateReleaseNotes } from "../lib/updateReleaseNotes";
import {
  DEFAULT_THEME_PRESET,
  normalizeThemePreset,
  resolveActiveThemePalette,
  type ThemePreset,
} from "../lib/themePresets";
import "./ProjectDashboard.css";

type ThemeMode = "dark" | "light";
type ThemePreference = "system" | ThemeMode;
type ClaudeStartupSettings = {
  enabled: boolean;
  customArgs: string;
};

type IntegrationSettings = {
  default_external_terminal: string;
  default_external_editor: string;
};

type SettingsPanel = "appearance" | "claude" | "integrations";

type ThemePalette = {
  app_bg: string;
  panel_bg: string;
  border_color: string;
  border_soft: string;
  text_main: string;
  text_sub: string;
  text_soft: string;
  hover_bg: string;
  selected_bg: string;
  selected_text: string;
  button_bg: string;
  button_hover: string;
  button_text: string;
  alert_bg: string;
  alert_border: string;
  alert_text: string;
  accent: string;
  terminal_background: string;
  terminal_foreground: string;
  terminal_cursor: string;
  terminal_selection: string;
  terminal_scrollbar: string;
  terminal_scrollbar_hover: string;
  terminal_font_family: string;
  terminal_scrollbar_width: number;
};

type ThemePalettes = {
  dark: ThemePalette;
  light: ThemePalette;
};

type TerminalThemePalette = {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  scrollbar: string;
  scrollbarHover: string;
  fontFamily: string;
  scrollbarWidth: number;
};

type WindowSettings = {
  width: number;
  height: number;
};

type LastOpenedSessionRef = {
  project_path: string;
  session_id: string;
};

type AppSettingsFile = {
  version: number;
  appearance: {
    theme_preference: ThemePreference;
    theme_preset: ThemePreset;
    language: AppLanguage;
    theme_palettes: ThemePalettes;
  };
  claude: {
    use_custom_startup_args: boolean;
    custom_startup_args: string;
  };
  integrations: IntegrationSettings;
  ui: {
    sidebar_collapsed: boolean;
    layout: {
      sidebar_width: number;
      main_width: number;
      terminal_height: number;
    };
    window: WindowSettings;
    project_tree: {
      expanded_projects: Record<string, boolean>;
      show_all_sessions: Record<string, boolean>;
      project_order: string[];
    };
  };
  sessions: {
    aliases: Record<string, string>;
    hidden: Record<string, boolean>;
    restore_last_opened_session: boolean;
    last_opened: LastOpenedSessionRef | null;
  };
};

type PtyExitPayload = {
  session_id: string;
  status?: string;
};

type PtyCreateFailedPayload = {
  session_id: string;
  error?: string;
};

const DEFAULT_CLAUDE_CUSTOM_ARGS = "--dangerously-skip-permissions";
const DEFAULT_EXTERNAL_TERMINAL = "Terminal";
const DEFAULT_EXTERNAL_EDITOR = "VSCode";
const DEFAULT_VISIBLE_SESSIONS = 3;
const PLAIN_SESSION_DISCOVERY_POLL_MS = 1500;
const SETTINGS_PERSIST_DEBOUNCE_MS = 480;
const INVALID_CLAUDE_SESSION_OUTPUT_PATTERN = /No conversation found with session ID:/i;
const INVALID_SESSION_OUTPUT_BUFFER_LIMIT = 600;
const WORKSPACE_TRUST_OUTPUT_BUFFER_LIMIT = 2400;
const UPDATE_CHECK_EVENT = "check-for-updates";
const DEFAULT_TERMINAL_FONT_FAMILY =
  '"JetBrains Mono", "SF Pro Text", "SF Mono", "SFMono-Regular", "Consolas", "Menlo", "Monaco", "Courier New", "DejaVu Sans Mono", "Liberation Mono", "Noto Sans Mono", "Noto Sans Mono CJK SC", "Noto Sans Mono CJK JP", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "WenQuanYi Micro Hei", "Noto Color Emoji", "Segoe UI", "Ubuntu Mono", monospace';
const TERMINAL_SCROLLBAR_WIDTH_OPTIONS = [4, 5, 6, 8] as const;
const DEFAULT_TERMINAL_SCROLLBAR_WIDTH = 6;
const tryGetCurrentWindow = () => {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
};

const stripAnsiSequences = (value: string): string => {
  return value.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
};

const DEFAULT_LAYOUT_SETTINGS = {
  sidebar_width: 300,
  main_width: 500,
  terminal_height: 300,
};

const DEFAULT_WINDOW_SETTINGS: WindowSettings = {
  width: 1200,
  height: 800,
};

const WINDOW_SIZE_LIMITS = {
  minWidth: 860,
  maxWidth: 5200,
  minHeight: 560,
  maxHeight: 3200,
};

const DEFAULT_THEME_PALETTES: ThemePalettes = {
  dark: {
    app_bg: "#002b36",
    panel_bg: "#073642",
    border_color: "rgba(147, 161, 161, 0.20)",
    border_soft: "rgba(147, 161, 161, 0.28)",
    text_main: "#93a1a1",
    text_sub: "#657b83",
    text_soft: "#839496",
    hover_bg: "rgba(147, 161, 161, 0.10)",
    selected_bg: "rgba(147, 161, 161, 0.08)",
    selected_text: "#93a1a1",
    button_bg: "rgba(147, 161, 161, 0.12)",
    button_hover: "rgba(147, 161, 161, 0.20)",
    button_text: "#93a1a1",
    alert_bg: "#7f1d1d",
    alert_border: "#b91c1c",
    alert_text: "#fecaca",
    accent: "#268bd2",
    terminal_background: "#002b36",
    terminal_foreground: "#839496",
    terminal_cursor: "#93a1a1",
    terminal_selection: "#073642",
    terminal_scrollbar: "rgba(88, 110, 117, 0.48)",
    terminal_scrollbar_hover: "rgba(88, 110, 117, 0.66)",
    terminal_font_family: DEFAULT_TERMINAL_FONT_FAMILY,
    terminal_scrollbar_width: DEFAULT_TERMINAL_SCROLLBAR_WIDTH,
  },
  light: {
    app_bg: "#f7f7f8",
    panel_bg: "#f3f3f5",
    border_color: "rgba(88, 96, 105, 0.14)",
    border_soft: "rgba(88, 96, 105, 0.20)",
    text_main: "#4d5560",
    text_sub: "#7a838f",
    text_soft: "#6d7580",
    hover_bg: "rgba(88, 96, 105, 0.08)",
    selected_bg: "rgba(88, 96, 105, 0.06)",
    selected_text: "#4d5560",
    button_bg: "rgba(88, 96, 105, 0.08)",
    button_hover: "rgba(88, 96, 105, 0.13)",
    button_text: "#6d7580",
    alert_bg: "#fee2e2",
    alert_border: "#fca5a5",
    alert_text: "#7f1d1d",
    accent: "#6b87d6",
    terminal_background: "#fafafb",
    terminal_foreground: "#4f5a63",
    terminal_cursor: "#4f5a63",
    terminal_selection: "#e9eaed",
    terminal_scrollbar: "rgba(88, 96, 105, 0.34)",
    terminal_scrollbar_hover: "rgba(88, 96, 105, 0.52)",
    terminal_font_family: DEFAULT_TERMINAL_FONT_FAMILY,
    terminal_scrollbar_width: DEFAULT_TERMINAL_SCROLLBAR_WIDTH,
  },
};

const THEME_PALETTE_STRING_KEYS = [
  "app_bg",
  "panel_bg",
  "border_color",
  "border_soft",
  "text_main",
  "text_sub",
  "text_soft",
  "hover_bg",
  "selected_bg",
  "selected_text",
  "button_bg",
  "button_hover",
  "button_text",
  "alert_bg",
  "alert_border",
  "alert_text",
  "accent",
  "terminal_background",
  "terminal_foreground",
  "terminal_cursor",
  "terminal_selection",
  "terminal_scrollbar",
  "terminal_scrollbar_hover",
  "terminal_font_family",
] as const;

const normalizeCustomClaudeArgs = (raw: string): string[] => {
  const tokens = raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];

  return tokens
    .map((token) => {
      if (
        (token.startsWith('"') && token.endsWith('"')) ||
        (token.startsWith("'") && token.endsWith("'"))
      ) {
        return token.slice(1, -1);
      }

      return token;
    })
    .map((value) => value.trim())
    .filter(Boolean);
};

const shellQuoteArg = (value: string): string => {
  if (!value) {
    return "''";
  }

  return `'${value.replace(/'/g, `'\\''`)}'`;
};

const formatClaudeCommand = (args: string[]): string => {
  if (args.length === 0) {
    return "claude";
  }

  return `claude ${args.map(shellQuoteArg).join(" ")}`;
};

const normalizeBooleanRecord = (value: unknown): Record<string, boolean> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, currentValue]) => {
      if (key.trim().length === 0 || typeof currentValue !== "boolean") {
        return [];
      }

      return [[key, currentValue] as [string, boolean]];
    })
  );
};

const normalizeStringRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, currentValue]) => {
      if (key.trim().length === 0 || typeof currentValue !== "string") {
        return [];
      }

      const normalized = currentValue.replace(/\s+/g, " ").trim();
      return normalized ? [[key, normalized]] : [];
    })
  );
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const next: string[] = [];
  const seen = new Set<string>();

  for (const current of value) {
    if (typeof current !== "string") {
      continue;
    }

    const normalized = current.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    next.push(normalized);
  }

  return next;
};

const normalizeLastOpenedSession = (value: unknown): LastOpenedSessionRef | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const projectPath =
    typeof source.project_path === "string" ? source.project_path.replace(/\s+/g, " ").trim() : "";
  const sessionId =
    typeof source.session_id === "string" ? source.session_id.replace(/\s+/g, " ").trim() : "";

  if (!projectPath || !sessionId) {
    return null;
  }

  return {
    project_path: projectPath,
    session_id: sessionId,
  };
};

const normalizeThemePalette = (value: unknown, fallback: ThemePalette): ThemePalette => {
  if (!value || typeof value !== "object") {
    return { ...fallback };
  }

  const source = value as Record<string, unknown>;
  const next = { ...fallback };

  for (const key of THEME_PALETTE_STRING_KEYS) {
    const current = source[key];
    if (typeof current === "string" && current.trim().length > 0) {
      next[key] = current.trim();
    }
  }

  const fontFamily = normalizeNonEmptyString(
    source.terminal_font_family,
    fallback.terminal_font_family
  );
  const scrollbarWidth = normalizeTerminalScrollbarWidth(
    source.terminal_scrollbar_width,
    fallback.terminal_scrollbar_width
  );

  return {
    ...next,
    terminal_font_family: fontFamily,
    terminal_scrollbar_width: scrollbarWidth,
  };
};

const normalizeTerminalScrollbarWidth = (
  value: unknown,
  fallback: number
): number => {
  const terminalWidth =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value.trim())
      : fallback;

  if (!Number.isFinite(terminalWidth) || !Number.isInteger(terminalWidth)) {
    return fallback;
  }

  return TERMINAL_SCROLLBAR_WIDTH_OPTIONS.includes(
    terminalWidth as (typeof TERMINAL_SCROLLBAR_WIDTH_OPTIONS)[number]
  )
    ? terminalWidth
    : fallback;
};

const normalizeThemePalettes = (value: unknown): ThemePalettes => {
  if (!value || typeof value !== "object") {
    return {
      dark: { ...DEFAULT_THEME_PALETTES.dark },
      light: { ...DEFAULT_THEME_PALETTES.light },
    };
  }

  const source = value as Record<string, unknown>;
  return {
    dark: normalizeThemePalette(source.dark, DEFAULT_THEME_PALETTES.dark),
    light: normalizeThemePalette(source.light, DEFAULT_THEME_PALETTES.light),
  };
};

const toNumber = (value: unknown, fallback: number): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

const normalizeNonEmptyString = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
};

const toLayoutState = (
  layout: Partial<AppSettingsFile["ui"]["layout"]> | null | undefined
): LayoutState => {
  return {
    sidebarWidth: toNumber(layout?.sidebar_width, DEFAULT_LAYOUT_SETTINGS.sidebar_width),
    mainWidth: toNumber(layout?.main_width, DEFAULT_LAYOUT_SETTINGS.main_width),
    terminalHeight: toNumber(layout?.terminal_height, DEFAULT_LAYOUT_SETTINGS.terminal_height),
  };
};

const normalizeWindowSettings = (
  windowValue: Partial<WindowSettings> | null | undefined
): WindowSettings => {
  const width = Math.round(toNumber(windowValue?.width, DEFAULT_WINDOW_SETTINGS.width));
  const height = Math.round(toNumber(windowValue?.height, DEFAULT_WINDOW_SETTINGS.height));

  return {
    width: Math.max(WINDOW_SIZE_LIMITS.minWidth, Math.min(width, WINDOW_SIZE_LIMITS.maxWidth)),
    height: Math.max(
      WINDOW_SIZE_LIMITS.minHeight,
      Math.min(height, WINDOW_SIZE_LIMITS.maxHeight)
    ),
  };
};

const applyProjectOrder = (items: Project[], order: string[]): Project[] => {
  if (items.length <= 1 || order.length === 0) {
    return items;
  }

  const indexById = new Map(order.map((id, index) => [id, index] as const));
  const ranked = items.map((item, index) => ({
    item,
    index,
    rank: indexById.get(item.id) ?? Number.MAX_SAFE_INTEGER,
  }));

  ranked.sort((left, right) => {
    if (left.rank !== right.rank) {
      return left.rank - right.rank;
    }

    return left.index - right.index;
  });

  const next = ranked.map((entry) => entry.item);
  const changed = next.some((item, index) => item.id !== items[index]?.id);
  return changed ? next : items;
};

export function ProjectDashboard() {
  const {
    listProjects,
    listClaudeSessions,
    createProject,
    deleteProject,
    closePty,
    writePty,
    getAvailableTerminals,
    getAvailableEditors,
    openProjectInTerminal,
    openProjectInEditor,
    deleteClaudeSession,
    checkForUpdates,
    downloadAndOpenUpdate,
    openExternalUrl,
    clearError,
    error,
  } = useBackend();

  const { layout, setLayoutState, updateSidebarWidth } = useWindowManager();

  const [projects, setProjects] = useState<Project[]>([]);
  const [claudeSessionsByProject, setClaudeSessionsByProject] = useState<
    Record<string, ClaudeSession[]>
  >({});
  const [projectsReady, setProjectsReady] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [showAllSessions, setShowAllSessions] = useState<Record<string, boolean>>({});
  const [projectOrder, setProjectOrder] = useState<string[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [openTerminalSessionIds, setOpenTerminalSessionIds] = useState<Set<string>>(new Set());
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [updateState, setUpdateState] = useState(createIdleUpdateState);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [downloadedUpdate, setDownloadedUpdate] = useState<DownloadedUpdateResult | null>(null);
  const [sessionAliases, setSessionAliases] = useState<Record<string, string>>({});
  const [hiddenClaudeSessions, setHiddenClaudeSessions] = useState<Record<string, boolean>>({});
  const [restoreLastOpenedSession, setRestoreLastOpenedSession] = useState(true);
  const [lastOpenedSession, setLastOpenedSession] = useState<LastOpenedSessionRef | null>(null);
  const [defaultExternalTerminal, setDefaultExternalTerminal] = useState(
    DEFAULT_EXTERNAL_TERMINAL
  );
  const [defaultExternalEditor, setDefaultExternalEditor] = useState(DEFAULT_EXTERNAL_EDITOR);
  const [availableExternalTerminals, setAvailableExternalTerminals] = useState<string[]>([
    DEFAULT_EXTERNAL_TERMINAL,
  ]);
  const [availableExternalEditors, setAvailableExternalEditors] = useState<string[]>([
    DEFAULT_EXTERNAL_EDITOR,
  ]);
  const [activeSessionMenuId, setActiveSessionMenuId] = useState<string | null>(null);
  const [settingsReloadToken, setSettingsReloadToken] = useState(0);
  const [initialSelectionResolved, setInitialSelectionResolved] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionNameDraft, setSessionNameDraft] = useState("");
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>("light");
  const [themePreset, setThemePreset] = useState<ThemePreset>(DEFAULT_THEME_PRESET);
  const [appLanguage, setAppLanguage] = useState<AppLanguage>(DEFAULT_APP_LANGUAGE);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);
  const [themePalettes, setThemePalettes] = useState<ThemePalettes>(DEFAULT_THEME_PALETTES);
  const [isStartupSettingsOpen, setIsStartupSettingsOpen] = useState(false);
  const [activeSettingsPanel, setActiveSettingsPanel] = useState<SettingsPanel>("claude");
  const [settingsReady, setSettingsReady] = useState(false);
  const [appWindowSize, setAppWindowSize] = useState<WindowSettings>(DEFAULT_WINDOW_SETTINGS);
  const [claudeStartupSettings, setClaudeStartupSettings] = useState<ClaudeStartupSettings>({
    enabled: false,
    customArgs: DEFAULT_CLAUDE_CUSTOM_ARGS,
  });

  const lastPersistedSettingsRef = useRef<string>("");
  const themeTransitionTimerRef = useRef<number | null>(null);
  const hasThemeModeMountedRef = useRef(false);
  const sidebarResizeRafRef = useRef<number | null>(null);
  const pendingSidebarWidthRef = useRef<number | null>(null);
  const windowResizeRafRef = useRef<number | null>(null);
  const invalidSessionOutputBufferRef = useRef<Map<string, string>>(new Map());
  const workspaceTrustOutputBufferRef = useRef<Map<string, string>>(new Map());
  const autoConfirmedTrustPromptRef = useRef<Set<string>>(new Set());
  const updateStateRef = useRef(updateState);

  const t = useMemo(() => createTranslator(appLanguage), [appLanguage]);

  useEffect(() => {
    updateStateRef.current = updateState;
  }, [updateState]);

  const normalizeErrorMessage = useCallback((value: unknown): string => {
    return value instanceof Error ? value.message : String(value);
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    const nextState = beginUpdateCheck(updateStateRef.current);
    setIsUpdateDialogOpen(true);
    setDownloadedUpdate(null);
    if (nextState === updateStateRef.current) {
      setStatusMessage(t("status_update_busy"));
      return;
    }

    updateStateRef.current = nextState;
    setUpdateState(nextState);
    setStatusMessage(t("status_update_checking"));

    try {
      const result = await checkForUpdates();
      const checkedState = applyUpdateCheckResult(nextState, result);
      updateStateRef.current = checkedState;
      setUpdateState(checkedState);

      if (!result.update_available) {
        setStatusMessage(t("status_update_up_to_date", { version: result.latest_version }));
        return;
      }
    } catch (error) {
      const message = normalizeErrorMessage(error);
      const erroredState = applyUpdateError(updateStateRef.current, message);
      updateStateRef.current = erroredState;
      setUpdateState(erroredState);
      setStatusMessage(t("status_update_failed", { message }));
    }
  }, [checkForUpdates, normalizeErrorMessage, t]);

  const handleDownloadUpdate = useCallback(async () => {
    const currentState = updateStateRef.current;
    const metadata = currentState.metadata;
    if (!metadata) {
      return;
    }

    const downloadingState = beginUpdateDownload(currentState);
    if (downloadingState === currentState) {
      return;
    }

    updateStateRef.current = downloadingState;
    setUpdateState(downloadingState);
    setStatusMessage(t("status_update_downloading", { version: metadata.latest_version }));

    try {
      const downloadResult = await downloadAndOpenUpdate({
        download_url: metadata.download_url,
        asset_name: metadata.asset_name,
        expected_sha256: metadata.expected_sha256,
        version: metadata.latest_version,
      });

      setDownloadedUpdate(downloadResult);
      const completedState = applyUpdateSuccess(downloadingState);
      updateStateRef.current = completedState;
      setUpdateState(completedState);
      setStatusMessage(t("status_update_installer_opened", { version: downloadResult.version }));
    } catch (error) {
      const message = normalizeErrorMessage(error);
      const erroredState = applyUpdateError(updateStateRef.current, message);
      updateStateRef.current = erroredState;
      setUpdateState(erroredState);
      setStatusMessage(t("status_update_failed", { message }));
    }
  }, [downloadAndOpenUpdate, normalizeErrorMessage, t]);

  const handleOpenUpdateRelease = useCallback(async () => {
    const releaseUrl = updateStateRef.current.metadata?.release_url?.trim();
    if (!releaseUrl) {
      return;
    }

    try {
      await openExternalUrl(releaseUrl);
    } catch (error) {
      const message = normalizeErrorMessage(error);
      setStatusMessage(t("status_open_release_failed", { message }));
    }
  }, [normalizeErrorMessage, openExternalUrl, t]);

  const handleCloseUpdateDialog = useCallback(() => {
    const phase = updateStateRef.current.phase;
    if (phase === "checking" || phase === "downloading") {
      return;
    }

    const idleState = createIdleUpdateState();
    updateStateRef.current = idleState;
    setUpdateState(idleState);
    setDownloadedUpdate(null);
    setIsUpdateDialogOpen(false);
  }, []);

  const getSessionAlias = useCallback(
    (session: Pick<ClaudeSession, "project_path" | "session_id">): string | null => {
      return getSessionAliasForItem(sessionAliases, session);
    },
    [sessionAliases]
  );


  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStatusMessage("");
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      console.error("Unhandled window error", event.error ?? event.message);
      setStatusMessage(t("status_unexpected_error"));
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection", event.reason);
      setStatusMessage(t("status_unexpected_error"));
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [t]);

  useEffect(() => {
    let unlistenSettingsMenu: (() => void) | null = null;
    let unlistenReloadConfig: (() => void) | null = null;
    let unlistenCheckForUpdates: (() => void) | null = null;

    const setupMenuListeners = async () => {
      try {
        unlistenSettingsMenu = await listen("open-settings", () => {
          setActiveSettingsPanel("claude");
          setIsStartupSettingsOpen(true);
        });

        unlistenReloadConfig = await listen("reload-settings", () => {
          setSettingsReloadToken((previous) => previous + 1);
          setStatusMessage(t("status_reload_settings"));
        });

        unlistenCheckForUpdates = await listen(UPDATE_CHECK_EVENT, () => {
          void handleCheckForUpdates();
        });
      } catch (error) {
        console.warn("Failed to register macOS menu listeners", error);
      }
    };

    void setupMenuListeners();

    return () => {
      if (unlistenSettingsMenu) {
        unlistenSettingsMenu();
      }

      if (unlistenReloadConfig) {
        unlistenReloadConfig();
      }

      if (unlistenCheckForUpdates) {
        unlistenCheckForUpdates();
      }
    };
  }, [handleCheckForUpdates, t]);

  useEffect(() => {
    let unlistenPtyExit: (() => void) | null = null;
    let unlistenPtyCreateFailed: (() => void) | null = null;

    const cleanupTerminalSessionState = (sessionId: string) => {
      const normalizedSessionId = sessionId.trim();
      if (!normalizedSessionId) {
        return;
      }

      invalidSessionOutputBufferRef.current.delete(normalizedSessionId);
      workspaceTrustOutputBufferRef.current.delete(normalizedSessionId);
      autoConfirmedTrustPromptRef.current.delete(normalizedSessionId);

      setOpenTerminalSessionIds((previous) => {
        if (!previous.has(normalizedSessionId)) {
          return previous;
        }

        const next = new Set(previous);
        next.delete(normalizedSessionId);
        return next;
      });

      setActiveTerminalId((previous) =>
        previous === normalizedSessionId ? null : previous
      );
    };

    const setupPtyLifecycleListeners = async () => {
      try {
        unlistenPtyExit = await listen<PtyExitPayload>("pty-exit", (event) => {
          cleanupTerminalSessionState(event.payload?.session_id ?? "");
        });

        unlistenPtyCreateFailed = await listen<PtyCreateFailedPayload>(
          "pty-create-failed",
          (event) => {
            const message =
              typeof event.payload?.error === "string"
                ? event.payload.error.trim()
                : "";
            if (message) {
              setStatusMessage(t("status_terminal_start_failed", { message }));
            }
          }
        );
      } catch (error) {
        console.warn("Failed to register PTY lifecycle listeners", error);
      }
    };

    void setupPtyLifecycleListeners();

    return () => {
      if (unlistenPtyExit) {
        unlistenPtyExit();
      }

      if (unlistenPtyCreateFailed) {
        unlistenPtyCreateFailed();
      }
    };
  }, [t]);

  // Keyboard shortcuts: ⌘B toggle sidebar, ⌘, open settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setActiveSettingsPanel("claude");
        setIsStartupSettingsOpen(true);
        return;
      }

      if (e.key === "Escape") {
        setActiveSessionMenuId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!activeSessionMenuId) {
      return;
    }

    const handleOutsideSessionMenuClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".session-menu-wrap")) {
        return;
      }

      setActiveSessionMenuId(null);
    };

    window.addEventListener("mousedown", handleOutsideSessionMenuClick);
    return () => window.removeEventListener("mousedown", handleOutsideSessionMenuClick);
  }, [activeSessionMenuId]);

  useEffect(() => {
    let cancelled = false;

    const loadExternalApps = async () => {
      try {
        const [terminalMap, editorMap] = await Promise.all([
          getAvailableTerminals(),
          getAvailableEditors(),
        ]);

        if (cancelled) {
          return;
        }

        const terminals = Object.keys(terminalMap || {}).sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" })
        );
        const editors = Object.keys(editorMap || {}).sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" })
        );

        setAvailableExternalTerminals((previous) => {
          const detected = terminals.length > 0 ? terminals : [DEFAULT_EXTERNAL_TERMINAL];
          return Array.from(new Set([...previous, ...detected, defaultExternalTerminal])).sort(
            (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })
          );
        });
        setAvailableExternalEditors((previous) => {
          const detected = editors.length > 0 ? editors : [DEFAULT_EXTERNAL_EDITOR];
          return Array.from(new Set([...previous, ...detected, defaultExternalEditor])).sort(
            (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })
          );
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        console.warn("Failed to detect external apps", loadError);
      }
    };

    void loadExternalApps();

    return () => {
      cancelled = true;
    };
  }, [defaultExternalEditor, defaultExternalTerminal, getAvailableEditors, getAvailableTerminals]);

  useEffect(() => {
    const syncWindowSize = () => {
      if (windowResizeRafRef.current !== null) {
        cancelAnimationFrame(windowResizeRafRef.current);
      }

      windowResizeRafRef.current = requestAnimationFrame(() => {
        windowResizeRafRef.current = null;
        setAppWindowSize((previous) => {
          const next = normalizeWindowSettings({
            width: window.innerWidth,
            height: window.innerHeight,
          });

          if (next.width === previous.width && next.height === previous.height) {
            return previous;
          }

          return next;
        });
      });
    };

    syncWindowSize();
    window.addEventListener("resize", syncWindowSize, { passive: true });

    return () => {
      if (windowResizeRafRef.current !== null) {
        cancelAnimationFrame(windowResizeRafRef.current);
        windowResizeRafRef.current = null;
      }

      window.removeEventListener("resize", syncWindowSize);
    };
  }, []);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const projectById = useMemo(() => {
    return new Map(projects.map((project) => [project.id, project] as const));
  }, [projects]);

  const projectByPath = useMemo(() => {
    return new Map(projects.map((project) => [project.path, project] as const));
  }, [projects]);

  const filteredSessionsByProject = useMemo(() => {
    const next: Record<string, ClaudeSession[]> = {};

    for (const project of projects) {
      next[project.id] = getVisibleClaudeSessions(
        claudeSessionsByProject[project.id] || [],
        hiddenClaudeSessions
      );
    }

    return next;
  }, [projects, claudeSessionsByProject, hiddenClaudeSessions]);

  const sessionLookupMap = useMemo(() => {
    const lookup = new Map<string, { project: Project; session: ClaudeSession }>();

    for (const project of projects) {
      const sessions = filteredSessionsByProject[project.id] || [];
      for (const session of sessions) {
        lookup.set(session.session_id, { project, session });
      }
    }

    return lookup;
  }, [filteredSessionsByProject, projects]);

  useEffect(() => {
    if (!selectedProject || !selectedSessionId) {
      return;
    }

    setLastOpenedSession((previous) => {
      if (
        previous?.project_path === selectedProject.path &&
        previous?.session_id === selectedSessionId
      ) {
        return previous;
      }

      return {
        project_path: selectedProject.path,
        session_id: selectedSessionId,
      };
    });
  }, [selectedProject, selectedSessionId]);

  const customClaudeArgs = useMemo(() => {
    if (!claudeStartupSettings.enabled) {
      return [];
    }

    return normalizeCustomClaudeArgs(claudeStartupSettings.customArgs);
  }, [claudeStartupSettings]);

  const quickStartClaudeCommand = useMemo(() => {
    return formatClaudeCommand(customClaudeArgs) + "\r";
  }, [customClaudeArgs]);

  const getWorkingDir = useCallback(
    (terminalId: string): string => {
      if (terminalId.startsWith("__plain__")) {
        const projectId = terminalId.replace("__plain__", "");
        return projectById.get(projectId)?.path || "";
      }

      const matched = sessionLookupMap.get(terminalId);
      return matched?.project.path || selectedProject?.path || "";
    },
    [projectById, selectedProject?.path, sessionLookupMap]
  );

  const refreshClaudeSessionsForProject = useCallback(
    async (projectId: string, projectPath: string) => {
      const sessions = await listClaudeSessions(projectPath);

      setClaudeSessionsByProject((previous) => {
        const currentSessions = previous[projectId] || [];
        if (!haveClaudeSessionsChanged(currentSessions, sessions)) {
          return previous;
        }

        return {
          ...previous,
          [projectId]: sessions,
        };
      });

      return sessions;
    },
    [listClaudeSessions]
  );

  const loadProjectsAndSessions = async () => {
    try {
      setProjectsReady(false);
      const loadedProjects = await listProjects();
      const orderedProjects = applyProjectOrder(loadedProjects, projectOrder);
      setProjects(orderedProjects);

      const entries: Array<readonly [string, ClaudeSession[]]> = [];
      const concurrency = 4;

      for (let index = 0; index < loadedProjects.length; index += concurrency) {
        const chunk = loadedProjects.slice(index, index + concurrency);

        const chunkEntries = await Promise.all(
          chunk.map(async (project) => {
            try {
              const sessions = await listClaudeSessions(project.path);
              return [project.id, sessions] as const;
            } catch {
              return [project.id, [] as ClaudeSession[]] as const;
            }
          })
        );

        entries.push(...chunkEntries);
      }

      const sessionsByProject = Object.fromEntries(entries);
      setClaudeSessionsByProject(sessionsByProject);

      setExpandedProjects((previous) => {
        const next = { ...previous };
        for (const project of orderedProjects) {
          if (next[project.id] === undefined) {
            next[project.id] = true;
          }
        }
        return next;
      });

    } catch (loadError) {
      console.error("Failed to load projects and sessions", loadError);
      setStatusMessage(t("status_load_failed"));
    } finally {
      setProjectsReady(true);
    }
  };

  useEffect(() => {
    void loadProjectsAndSessions();
  }, []);

  useEffect(() => {
    if (!projectsReady) {
      return;
    }

    const trackedProjects = getProjectsWithOpenPlainTerminals(projects, openTerminalSessionIds);
    if (trackedProjects.length === 0) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const refreshLoop = async () => {
      await Promise.all(
        trackedProjects.map(async (project) => {
          try {
            await refreshClaudeSessionsForProject(project.id, project.path);
          } catch (error) {
            if (!cancelled) {
              console.warn("Failed to refresh Claude sessions for project", project.path, error);
            }
          }
        })
      );

      if (!cancelled) {
        timeoutId = window.setTimeout(() => {
          void refreshLoop();
        }, PLAIN_SESSION_DISCOVERY_POLL_MS);
      }
    };

    void refreshLoop();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [openTerminalSessionIds, projects, projectsReady, refreshClaudeSessionsForProject]);

  useEffect(() => {
    if (projects.length === 0) {
      return;
    }

    if (projectOrder.length === 0) {
      setProjectOrder(projects.map((project) => project.id));
      return;
    }

    const reorderedProjects = applyProjectOrder(projects, projectOrder);
    if (reorderedProjects !== projects) {
      setProjects(reorderedProjects);
    }

    const normalizedOrder = reorderedProjects.map((project) => project.id);
    const hasOrderDiff =
      normalizedOrder.length !== projectOrder.length ||
      normalizedOrder.some((id, index) => id !== projectOrder[index]);

    if (hasOrderDiff) {
      setProjectOrder(normalizedOrder);
    }
  }, [projectOrder, projects]);

  useEffect(() => {
    let cancelled = false;

    const normalizeThemePreference = (value: string | null | undefined): ThemePreference => {
      if (value === "light" || value === "dark" || value === "system") {
        return value;
      }
      return "light";
    };

    const loadSettingsFromFile = async () => {
      try {
        const settings = await invoke<AppSettingsFile>("get_app_settings");
        if (cancelled) {
          return;
        }

        setThemePreference(normalizeThemePreference(settings.appearance?.theme_preference));
        setThemePreset(normalizeThemePreset(settings.appearance?.theme_preset));
        setAppLanguage(resolveAppLanguage(settings.appearance?.language));
        setThemePalettes(normalizeThemePalettes(settings.appearance?.theme_palettes));
        setClaudeStartupSettings({
          enabled: settings.claude?.use_custom_startup_args === true,
          customArgs:
            typeof settings.claude?.custom_startup_args === "string" &&
            settings.claude.custom_startup_args.trim().length > 0
              ? settings.claude.custom_startup_args
              : DEFAULT_CLAUDE_CUSTOM_ARGS,
        });

        const normalizedWindow = normalizeWindowSettings(settings.ui?.window);

        setIsSidebarCollapsed(settings.ui?.sidebar_collapsed === true);
        setLayoutState(toLayoutState(settings.ui?.layout));
        setAppWindowSize(normalizedWindow);
        const currentWindow = tryGetCurrentWindow();
        if (currentWindow) {
          await currentWindow
            .setSize(new LogicalSize(normalizedWindow.width, normalizedWindow.height))
            .catch((resizeError) => {
              console.warn("Failed to restore window size from settings", resizeError);
            });
        }
        setExpandedProjects(normalizeBooleanRecord(settings.ui?.project_tree?.expanded_projects));
        setShowAllSessions(normalizeBooleanRecord(settings.ui?.project_tree?.show_all_sessions));
        setProjectOrder(normalizeStringArray(settings.ui?.project_tree?.project_order));
        setSessionAliases(normalizeStringRecord(settings.sessions?.aliases));
        setHiddenClaudeSessions(normalizeBooleanRecord(settings.sessions?.hidden));
        setRestoreLastOpenedSession(settings.sessions?.restore_last_opened_session !== false);
        setLastOpenedSession(normalizeLastOpenedSession(settings.sessions?.last_opened));

        const configuredTerminal = normalizeNonEmptyString(
          settings.integrations?.default_external_terminal,
          DEFAULT_EXTERNAL_TERMINAL
        );
        const configuredEditor = normalizeNonEmptyString(
          settings.integrations?.default_external_editor,
          DEFAULT_EXTERNAL_EDITOR
        );

        setDefaultExternalTerminal(configuredTerminal);
        setDefaultExternalEditor(configuredEditor);
        setAvailableExternalTerminals((previous) =>
          previous.includes(configuredTerminal)
            ? previous
            : [...previous, configuredTerminal].sort((a, b) =>
                a.localeCompare(b, undefined, { sensitivity: "base" })
              )
        );
        setAvailableExternalEditors((previous) =>
          previous.includes(configuredEditor)
            ? previous
            : [...previous, configuredEditor].sort((a, b) =>
                a.localeCompare(b, undefined, { sensitivity: "base" })
              )
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.warn("Failed to load settings file", error);
        setStatusMessage(t("status_settings_load_failed"));
      } finally {
        if (!cancelled) {
          setSettingsReady(true);
        }
      }
    };

    void loadSettingsFromFile();

    return () => {
      cancelled = true;
    };
  }, [setLayoutState, settingsReloadToken]);

  useEffect(() => {
    if (!settingsReady || !projectsReady || initialSelectionResolved) {
      return;
    }

    if (projects.length === 0) {
      setInitialSelectionResolved(true);
      return;
    }

    const sessionsReady = projects.every((project) =>
      Array.isArray(claudeSessionsByProject[project.id])
    );
    if (!sessionsReady) {
      return;
    }

    if (restoreLastOpenedSession && lastOpenedSession) {
      const matchedProject = projectByPath.get(lastOpenedSession.project_path);
      const matchedSession = sessionLookupMap.get(lastOpenedSession.session_id);

      if (
        matchedProject &&
        matchedSession &&
        matchedSession.project.id === matchedProject.id
      ) {
        setSelectedProjectId(matchedProject.id);
        setSelectedSessionId(matchedSession.session.session_id);
        setInitialSelectionResolved(true);
        return;
      }
    }

    let mostRecentSession: ClaudeSession | null = null;
    let mostRecentProjectId: string | null = null;

    for (const project of projects) {
      const sessions = filteredSessionsByProject[project.id] || [];

      for (const session of sessions) {
        if (!mostRecentSession || session.modified > mostRecentSession.modified) {
          mostRecentSession = session;
          mostRecentProjectId = project.id;
        }
      }
    }

    if (mostRecentSession && mostRecentProjectId) {
      setSelectedProjectId(mostRecentProjectId);
      setSelectedSessionId(mostRecentSession.session_id);
    } else {
      setSelectedProjectId(projects[0].id);
      setSelectedSessionId(null);
    }

    setInitialSelectionResolved(true);
  }, [
    settingsReady,
    projectsReady,
    initialSelectionResolved,
    projects,
    claudeSessionsByProject,
    filteredSessionsByProject,
    projectByPath,
    restoreLastOpenedSession,
    lastOpenedSession,
    sessionLookupMap,
  ]);

  useEffect(() => {
    if (!settingsReady) {
      return;
    }

    const legacyAliasEntries = Object.entries(sessionAliases).filter(([key, value]) => {
      return !key.includes("::") && typeof value === "string" && value.trim().length > 0;
    });

    if (legacyAliasEntries.length === 0) {
      return;
    }

    setSessionAliases((previous) => {
      const currentLegacyEntries = Object.entries(previous).filter(([key, value]) => {
        return !key.includes("::") && typeof value === "string" && value.trim().length > 0;
      });

      if (currentLegacyEntries.length === 0) {
        return previous;
      }

      const sessionsById = new Map<string, ClaudeSession[]>();
      for (const sessions of Object.values(claudeSessionsByProject)) {
        for (const session of sessions) {
          const list = sessionsById.get(session.session_id) ?? [];
          list.push(session);
          sessionsById.set(session.session_id, list);
        }
      }

      let changed = false;
      const next = { ...previous };

      for (const [legacyKey, alias] of currentLegacyEntries) {
        const matchedSessions = sessionsById.get(legacyKey) ?? [];
        if (matchedSessions.length === 0) {
          continue;
        }

        for (const matchedSession of matchedSessions) {
          const namespacedKey = buildSessionAliasKey(
            matchedSession.project_path,
            matchedSession.session_id
          );

          if (!(namespacedKey in next)) {
            next[namespacedKey] = alias;
            changed = true;
          }
        }

        delete next[legacyKey];
        changed = true;
      }

      return changed ? next : previous;
    });
  }, [settingsReady, sessionAliases, claudeSessionsByProject]);

  useEffect(() => {
    if (!settingsReady) {
      return;
    }

    const settingsPayload: AppSettingsFile = {
      version: 11,
      appearance: {
        theme_preference: themePreference,
        theme_preset: themePreset,
        language: appLanguage,
        theme_palettes: themePalettes,
      },
      claude: {
        use_custom_startup_args: claudeStartupSettings.enabled,
        custom_startup_args:
          claudeStartupSettings.customArgs.trim() || DEFAULT_CLAUDE_CUSTOM_ARGS,
      },
      integrations: {
        default_external_terminal: defaultExternalTerminal,
        default_external_editor: defaultExternalEditor,
      },
      ui: {
        sidebar_collapsed: isSidebarCollapsed,
        layout: {
          sidebar_width: Math.round(layout.sidebarWidth),
          main_width: Math.round(layout.mainWidth),
          terminal_height: Math.round(layout.terminalHeight),
        },
        window: {
          width: Math.round(appWindowSize.width),
          height: Math.round(appWindowSize.height),
        },
        project_tree: {
          expanded_projects: expandedProjects,
          show_all_sessions: showAllSessions,
          project_order: projectOrder,
        },
      },
      sessions: {
        aliases: sessionAliases,
        hidden: hiddenClaudeSessions,
        restore_last_opened_session: restoreLastOpenedSession,
        last_opened: lastOpenedSession,
      },
    };

    const serializedPayload = JSON.stringify(settingsPayload);
    if (serializedPayload === lastPersistedSettingsRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void invoke("set_app_settings", {
        settings: settingsPayload,
      })
        .then(() => {
          lastPersistedSettingsRef.current = serializedPayload;
        })
        .catch((error) => {
          console.warn("Failed to persist settings file", error);
          setStatusMessage(t("status_settings_save_failed"));
        });
    }, SETTINGS_PERSIST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    settingsReady,
    themePreference,
    themePreset,
    appLanguage,
    themePalettes,
    claudeStartupSettings,
    defaultExternalTerminal,
    defaultExternalEditor,
    isSidebarCollapsed,
    layout,
    appWindowSize,
    expandedProjects,
    showAllSessions,
    projectOrder,
    sessionAliases,
    hiddenClaudeSessions,
    restoreLastOpenedSession,
    lastOpenedSession,
  ]);

  useEffect(() => {
    const currentWindow = tryGetCurrentWindow();
    if (!currentWindow) {
      if (themePreference !== "system") {
        setThemeMode(themePreference);
      }
      return;
    }

    let unlisten: (() => void) | null = null;

    const resolveThemeMode = (theme: string | null | undefined): ThemeMode =>
      theme === "light" ? "light" : "dark";

    const applyTheme = async () => {
      if (themePreference === "system") {
        const currentTheme = await currentWindow.theme();
        setThemeMode(resolveThemeMode(currentTheme));
        return;
      }

      setThemeMode(themePreference);
    };

    const subscribeThemeChanges = async () => {
      try {
        unlisten = await currentWindow.onThemeChanged((event) => {
          if (themePreference !== "system") {
            return;
          }

          setThemeMode(resolveThemeMode(event.payload));
        });
      } catch (listenError) {
        console.warn("Failed to subscribe theme changes", listenError);
      }
    };

    void applyTheme();
    void subscribeThemeChanges();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [themePreference]);

  useEffect(() => {
    if (!hasThemeModeMountedRef.current) {
      hasThemeModeMountedRef.current = true;
      return;
    }

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setIsThemeTransitioning(false);
      return;
    }

    setIsThemeTransitioning(true);

    if (themeTransitionTimerRef.current !== null) {
      window.clearTimeout(themeTransitionTimerRef.current);
    }

    themeTransitionTimerRef.current = window.setTimeout(() => {
      setIsThemeTransitioning(false);
      themeTransitionTimerRef.current = null;
    }, 260);

    return () => {
      if (themeTransitionTimerRef.current !== null) {
        window.clearTimeout(themeTransitionTimerRef.current);
        themeTransitionTimerRef.current = null;
      }
    };
  }, [themeMode]);

  const ensureClaudeSessionTerminalActive = useCallback(
    (sessionId: string) => {
      if (!sessionId || sessionId.startsWith("__plain__")) {
        return;
      }

      setOpenTerminalSessionIds((previous) => {
        const next = new Set(previous);

        for (const id of previous) {
          if (!id.startsWith("__plain__")) {
            continue;
          }

          void closePty(id).catch(() => {});
          next.delete(id);
        }

        next.add(sessionId);
        return next;
      });

      setActiveTerminalId(sessionId);
    },
    [closePty]
  );

  useEffect(() => {
    if (!selectedSessionId) {
      return;
    }

    ensureClaudeSessionTerminalActive(selectedSessionId);
  }, [ensureClaudeSessionTerminalActive, selectedSessionId]);

  useEffect(() => {
    if (openTerminalSessionIds.size === 0) {
      // Only clear if it was actually set
      setActiveTerminalId((previous) => (previous !== null ? null : previous));
      return;
    }

    // Ensure activeTerminalId is valid or set to a valid one
    setActiveTerminalId((previous) => {
      // If current activeTerminalId is still valid, keep it
      if (previous && openTerminalSessionIds.has(previous)) {
        return previous;
      }

      // Try to use selectedSessionId if it's in the set
      if (selectedSessionId && openTerminalSessionIds.has(selectedSessionId)) {
        return selectedSessionId;
      }

      // Fall back to first available terminal
      const firstOpenId = Array.from(openTerminalSessionIds)[0] ?? null;
      return firstOpenId;
    });
  }, [openTerminalSessionIds, selectedSessionId]);

  useEffect(() => {
    if (!projectsReady || openTerminalSessionIds.size === 0) {
      return;
    }

    const validClaudeSessionIds = new Set(sessionLookupMap.keys());
    const validPlainTerminalIds = new Set(projects.map((project) => `__plain__${project.id}`));

    const invalidIds = Array.from(openTerminalSessionIds).filter((id) => {
      if (id.startsWith("__plain__")) {
        return !validPlainTerminalIds.has(id);
      }

      return !validClaudeSessionIds.has(id);
    });

    if (invalidIds.length === 0) {
      return;
    }

    setOpenTerminalSessionIds((previous) => {
      const next = new Set(previous);
      let changed = false;

      for (const invalidId of invalidIds) {
        if (next.delete(invalidId)) {
          changed = true;
        }
      }

      return changed ? next : previous;
    });

    for (const invalidId of invalidIds) {
      void closePty(invalidId).catch(() => {});
    }

    setSelectedSessionId((previous) => {
      if (!previous || invalidIds.includes(previous)) {
        return null;
      }

      return previous;
    });

    setActiveTerminalId((previous) => {
      if (!previous || invalidIds.includes(previous)) {
        return null;
      }

      return previous;
    });
  }, [closePty, openTerminalSessionIds, projects, projectsReady, sessionLookupMap]);

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects((previous) => ({
      ...previous,
      [projectId]: !previous[projectId],
    }));
  };

  const handleProjectDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    projectId: string
  ) => {
    setDraggingProjectId(projectId);
    setDragOverProjectId(projectId);
    setActiveSessionMenuId(null);

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-ccsm-project-id", projectId);
    event.dataTransfer.setData("text/plain", projectId);
  };

  const handleProjectDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    projectId: string
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (dragOverProjectId !== projectId) {
      setDragOverProjectId(projectId);
    }
  };

  const handleProjectDrop = (
    event: React.DragEvent<HTMLDivElement>,
    projectId: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const sourceProjectId =
      draggingProjectId ||
      event.dataTransfer.getData("application/x-ccsm-project-id")?.trim() ||
      event.dataTransfer.getData("text/plain")?.trim();

    if (!sourceProjectId || sourceProjectId === projectId) {
      setDragOverProjectId(null);
      setDraggingProjectId(null);
      return;
    }

    let nextProjectIds: string[] = [];
    let didReorder = false;

    setProjects((previous) => {
      const sourceIndex = previous.findIndex((item) => item.id === sourceProjectId);
      const targetIndex = previous.findIndex((item) => item.id === projectId);

      if (sourceIndex === -1 || targetIndex === -1) {
        return previous;
      }

      const next = [...previous];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      nextProjectIds = next.map((item) => item.id);
      didReorder = true;
      return next;
    });

    if (didReorder) {
      setProjectOrder(nextProjectIds);
    }

    setDragOverProjectId(null);
    setDraggingProjectId(null);
  };

  const handleProjectDragEnd = () => {
    setDragOverProjectId(null);
    setDraggingProjectId(null);
  };

  const handleQuickCreateProject = async () => {
    try {
      const selectedPath = await invoke<string | null>("pick_project_folder");
      if (!selectedPath) {
        setStatusMessage(t("status_project_create_cancelled"));
        return;
      }

      const inferredName =
        selectedPath.split(/[\\/]/).filter(Boolean).pop() || t("fallback_new_project");
      const created = await createProject({ name: inferredName, path: selectedPath });

      setProjects((previous) => [...previous, created]);
      setProjectOrder((previous) =>
        previous.includes(created.id) ? previous : [...previous, created.id]
      );
      setClaudeSessionsByProject((previous) => ({ ...previous, [created.id]: [] }));
      setExpandedProjects((previous) => ({ ...previous, [created.id]: true }));
      setSelectedProjectId(created.id);
      setSelectedSessionId(null);
      setStatusMessage(t("status_project_added", { name: created.name }));

      try {
        const sessions = await listClaudeSessions(created.path);
        setClaudeSessionsByProject((previous) => ({ ...previous, [created.id]: sessions }));
      } catch {
        // No sessions found
      }
    } catch (createError) {
      console.error("Failed to create project", createError);
      const message = createError instanceof Error ? createError.message : String(createError);
      window.alert(t("status_project_create_failed", { message }));
      setStatusMessage(t("status_project_create_failed", { message }));
    }
  };

  const handleMouseDownDivider = (event: React.MouseEvent) => {
    if (isSidebarCollapsed) return;

    setIsDraggingDivider(true);
    const startX = event.clientX;
    const startWidth = layout.sidebarWidth;

    const flushSidebarWidth = () => {
      sidebarResizeRafRef.current = null;
      if (pendingSidebarWidthRef.current === null) {
        return;
      }

      updateSidebarWidth(pendingSidebarWidthRef.current);
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      pendingSidebarWidthRef.current = startWidth + delta;

      if (sidebarResizeRafRef.current !== null) {
        return;
      }

      sidebarResizeRafRef.current = requestAnimationFrame(flushSidebarWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);

      if (sidebarResizeRafRef.current !== null) {
        cancelAnimationFrame(sidebarResizeRafRef.current);
        sidebarResizeRafRef.current = null;
      }

      if (pendingSidebarWidthRef.current !== null) {
        updateSidebarWidth(pendingSidebarWidthRef.current);
        pendingSidebarWidthRef.current = null;
      }

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const formatSessionLabel = (session: ClaudeSession): string => {
    return getSessionAlias(session) || getDefaultSessionLabel(session);
  };

  const formatSessionTime = (dateStr: string): string => {
    if (!dateStr) return "";

    try {
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) {
        return "";
      }

      const now = Date.now();
      const diffMs = Math.max(0, now - date.getTime());
      const diffMinutes = Math.floor(diffMs / 60000);

      if (diffMinutes < 60) {
        return `${Math.max(1, diffMinutes)}m`;
      }

      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) {
        return `${diffHours}h`;
      }

      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d`;
    } catch {
      return "";
    }
  };

  const handleStopTerminal = async (sessionId: string) => {
    try {
      await closePty(sessionId);
      setOpenTerminalSessionIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });

      if (selectedSessionId === sessionId) {
        if (selectedProject) {
          const plainId = `__plain__${selectedProject.id}`;
          setOpenTerminalSessionIds((prev) => new Set(prev).add(plainId));
          setActiveTerminalId(plainId);
          setSelectedSessionId(null);
          return;
        }

        setSelectedSessionId(null);
        setActiveTerminalId(null);
      }
    } catch (err) {
      console.error("Failed to stop terminal", err);
      setStatusMessage(t("status_stop_terminal_failed"));
    }
  };

  const handleDeleteSession = async (
    projectId: string,
    projectPath: string,
    sessionId: string
  ) => {
    if (!window.confirm(t("confirm_delete_session"))) return;
    try {
      if (openTerminalSessionIds.has(sessionId)) {
        await closePty(sessionId);
        setOpenTerminalSessionIds((prev) => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      }
      await deleteClaudeSession(projectPath, sessionId);
      setClaudeSessionsByProject((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] || []).filter((s) => s.session_id !== sessionId),
      }));
      setSessionAliases((previous) => {
        return removeSessionAliasEntries(previous, {
          project_path: projectPath,
          session_id: sessionId,
        });
      });
      setHiddenClaudeSessions((previous) => {
        return removeHiddenClaudeSession(previous, {
          project_path: projectPath,
          session_id: sessionId,
        });
      });
      if (editingSessionId === sessionId) {
        setEditingSessionId(null);
      }
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
        setActiveTerminalId(null);
      }
      setStatusMessage(t("status_session_deleted"));
    } catch (err) {
      console.error("Failed to delete session", err);
      setStatusMessage(t("status_session_delete_failed"));
    }
  };

  const handleOpenProjectInExternalTerminal = async (projectPath: string) => {
    try {
      await openProjectInTerminal(projectPath, defaultExternalTerminal);
      setStatusMessage(t("status_opened_in_app", { app: defaultExternalTerminal }));
    } catch (openError) {
      console.error("Failed to open project in external terminal", openError);
      setStatusMessage(t("status_open_terminal_failed"));
    }
  };

  const handleOpenProjectInEditor = async (projectPath: string) => {
    try {
      await openProjectInEditor(projectPath, defaultExternalEditor);
      setStatusMessage(t("status_opened_in_app", { app: defaultExternalEditor }));
    } catch (openError) {
      console.error("Failed to open project in editor", openError);
      setStatusMessage(t("status_open_editor_failed"));
    }
  };

  const writePtyWithRetry = async (
    sessionId: string,
    data: string,
    attempt = 0
  ): Promise<void> => {
    try {
      await writePty(sessionId, data);
    } catch {
      if (attempt >= 8) {
        setStatusMessage(t("status_terminal_write_failed"));
        return;
      }

      window.setTimeout(() => {
        void writePtyWithRetry(sessionId, data, attempt + 1);
      }, 120);
    }
  };
  const handleToggleCustomClaudeArgs = (enabled: boolean) => {
    setClaudeStartupSettings((previous) => ({
      enabled,
      customArgs:
        enabled && !previous.customArgs.trim()
          ? DEFAULT_CLAUDE_CUSTOM_ARGS
          : previous.customArgs,
    }));
  };

  const handleQuickNewSession = async (event: React.MouseEvent, project: Project) => {
    event.stopPropagation();

    const plainId = `__plain__${project.id}`;
    setSelectedProjectId(project.id);
    setSelectedSessionId(null);
    setOpenTerminalSessionIds((previous) => {
      const next = new Set(previous);
      next.add(plainId);
      return next;
    });
    setActiveTerminalId(plainId);

    await writePtyWithRetry(plainId, quickStartClaudeCommand);
  };

  const handleDeleteProject = async (event: React.MouseEvent, project: Project) => {
    event.stopPropagation();

    if (!window.confirm(t("confirm_delete_project", { name: project.name }))) {
      return;
    }

    try {
      const plainId = `__plain__${project.id}`;
      const projectSessionIds = (claudeSessionsByProject[project.id] || []).map(
        (session) => session.session_id
      );

      const openIdsToClose = [plainId, ...projectSessionIds].filter((sessionId, index, array) => {
        return array.indexOf(sessionId) === index && openTerminalSessionIds.has(sessionId);
      });

      await Promise.all(openIdsToClose.map((sessionId) => closePty(sessionId).catch(() => {})));

      if (openIdsToClose.length > 0) {
        setOpenTerminalSessionIds((previous) => {
          const next = new Set(previous);
          for (const sessionId of openIdsToClose) {
            next.delete(sessionId);
          }
          return next;
        });
      }

      if (activeTerminalId && openIdsToClose.includes(activeTerminalId)) {
        setActiveTerminalId(null);
      }

      if (selectedSessionId && projectSessionIds.includes(selectedSessionId)) {
        setSelectedSessionId(null);
      }

      await deleteProject(project.id);

      const remainingProjects = projects.filter((item) => item.id !== project.id);
      setProjects(remainingProjects);
      setProjectOrder((previous) => previous.filter((id) => id !== project.id));

      if (selectedProjectId === project.id) {
        setSelectedProjectId(remainingProjects[0]?.id || null);
        setSelectedSessionId(null);
      }

      setClaudeSessionsByProject((previous) => {
        const next = { ...previous };
        delete next[project.id];
        return next;
      });

      setExpandedProjects((previous) => {
        const next = { ...previous };
        delete next[project.id];
        return next;
      });

      setShowAllSessions((previous) => {
        const next = { ...previous };
        delete next[project.id];
        return next;
      });

      setSessionAliases((previous) => {
        let next = previous;
        for (const session of claudeSessionsByProject[project.id] || []) {
          next = removeSessionAliasEntries(next, session);
        }
        return next;
      });
      setHiddenClaudeSessions((previous) => {
        let next = previous;
        for (const session of claudeSessionsByProject[project.id] || []) {
          next = removeHiddenClaudeSession(next, session);
        }
        return next;
      });

      setStatusMessage(t("status_project_removed", { name: project.name }));
    } catch (deleteError) {
      console.error("Failed to delete project", deleteError);
      setStatusMessage(t("status_project_delete_failed"));
    }
  };

  const startEditingSessionLabel = (
    event: React.MouseEvent,
    projectId: string,
    session: ClaudeSession
  ) => {
    event.stopPropagation();
    setActiveSessionMenuId(null);
    setSelectedProjectId(projectId);
    setSelectedSessionId(session.session_id);
    setEditingSessionId(session.session_id);
    setSessionNameDraft(formatSessionLabel(session));
  };

  const cancelEditingSessionLabel = () => {
    setEditingSessionId(null);
    setSessionNameDraft("");
  };

  const saveEditingSessionLabel = (session: ClaudeSession) => {
    const aliasUpdate = updateSessionAliasesForDraft(sessionAliases, session, sessionNameDraft);

    if (aliasUpdate.status !== "unchanged") {
      setSessionAliases(aliasUpdate.aliases);
      clearError();
    }

    if (aliasUpdate.status === "updated" && aliasUpdate.alias) {
      setStatusMessage(t("status_session_alias_saved", { name: aliasUpdate.alias }));
    }

    if (aliasUpdate.status === "cleared") {
      setStatusMessage(t("status_session_alias_cleared"));
    }

    setEditingSessionId(null);
    setSessionNameDraft("");
  };

  const handleToggleSessionMenu = (
    event: React.MouseEvent,
    sessionId: string
  ) => {
    event.stopPropagation();
    setActiveSessionMenuId((previous) =>
      previous === sessionId ? null : sessionId
    );
  };

  const renderSessionActionMenu = (project: Project, session: ClaudeSession) => {
    const isSessionOpen = openTerminalSessionIds.has(session.session_id);

    return (
      <>
        <button
          className="session-action-menu-item"
          onClick={(event) => {
            startEditingSessionLabel(event, project.id, session);
            setActiveSessionMenuId(null);
          }}
        >
          <span className="session-action-icon edit" aria-hidden="true">✐</span>
          <span>{t("menu_edit_session_name")}</span>
        </button>
        <button
          className="session-action-menu-item"
          onClick={() => {
            setActiveSessionMenuId(null);
            void handleOpenProjectInExternalTerminal(project.path);
          }}
        >
          <span className="session-action-icon" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="14" rx="2" />
              <path d="M8 10l3 2-3 2" />
              <line x1="13" y1="14" x2="17" y2="14" />
            </svg>
          </span>
          <span>{t("menu_open_project_terminal")}</span>
        </button>
        <button
          className="session-action-menu-item"
          onClick={() => {
            setActiveSessionMenuId(null);
            void handleOpenProjectInEditor(project.path);
          }}
        >
          <span className="session-action-icon" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </span>
          <span>{t("menu_open_project_editor")}</span>
        </button>
        {isSessionOpen && (
          <button
            className="session-action-menu-item"
            onClick={() => {
              setActiveSessionMenuId(null);
              void handleStopTerminal(session.session_id);
            }}
          >
            <span className="session-action-icon" aria-hidden="true">■</span>
            <span>{t("menu_stop")}</span>
          </button>
        )}
        <button
          className="session-action-menu-item danger"
          onClick={() => {
            setActiveSessionMenuId(null);
            void handleDeleteSession(project.id, project.path, session.session_id);
          }}
        >
          <span className="session-action-icon" aria-hidden="true">✕</span>
          <span>{t("menu_delete")}</span>
        </button>
      </>
    );
  };

  const sidebarWidth = isSidebarCollapsed ? 0 : layout.sidebarWidth;
  // FIX: Don't use useMemo for Set->Array conversion, compute directly
  const openTerminalIds = Array.from(openTerminalSessionIds);

  const handleQuickThemeToggle = () => {
    setThemePreference((previous) => {
      const effectiveTheme = previous === "system" ? themeMode : previous;
      return effectiveTheme === "dark" ? "light" : "dark";
    });
  };

  const handleWindowTopDragMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      const targetElement = event.target as HTMLElement | null;
      if (!targetElement) {
        return;
      }

      const interactiveTarget = targetElement.closest(
        "button, a, input, select, textarea, [role='button'], [data-topbar-no-drag='true']"
      );

      if (interactiveTarget) {
        return;
      }

      const currentWindow = tryGetCurrentWindow();
      if (!currentWindow) {
        return;
      }

      void currentWindow.startDragging().catch((dragError) => {
        console.warn("Failed to start window dragging", dragError);
      });
    },
    []
  );

  const activeThemePalette = useMemo<ThemePalette>(() => {
    return resolveActiveThemePalette(themePreset, themeMode, themePalettes);
  }, [themeMode, themePalettes, themePreset]);

  const terminalThemePalette = useMemo<TerminalThemePalette>(() => {
    return {
      background: activeThemePalette.terminal_background,
      foreground: activeThemePalette.terminal_foreground,
      cursor: activeThemePalette.terminal_cursor,
      selectionBackground: activeThemePalette.terminal_selection,
      scrollbar: activeThemePalette.terminal_scrollbar,
      scrollbarHover: activeThemePalette.terminal_scrollbar_hover,
      fontFamily: activeThemePalette.terminal_font_family,
      scrollbarWidth: activeThemePalette.terminal_scrollbar_width,
    };
  }, [activeThemePalette]);

  const dashboardThemeStyle = useMemo(() => {
    return {
      "--app-bg": activeThemePalette.app_bg,
      "--panel-bg": activeThemePalette.panel_bg,
      "--border-color": activeThemePalette.border_color,
      "--border-soft": activeThemePalette.border_soft,
      "--text-main": activeThemePalette.text_main,
      "--text-sub": activeThemePalette.text_sub,
      "--text-soft": activeThemePalette.text_soft,
      "--hover-bg": activeThemePalette.hover_bg,
      "--selected-bg": activeThemePalette.selected_bg,
      "--selected-text": activeThemePalette.selected_text,
      "--button-bg": activeThemePalette.button_bg,
      "--button-hover": activeThemePalette.button_hover,
      "--button-text": activeThemePalette.button_text,
      "--alert-bg": activeThemePalette.alert_bg,
      "--alert-border": activeThemePalette.alert_border,
      "--alert-text": activeThemePalette.alert_text,
      "--accent": activeThemePalette.accent,
      "--terminal-background": activeThemePalette.terminal_background,
      "--terminal-scrollbar-color": activeThemePalette.terminal_scrollbar,
      "--terminal-scrollbar-hover-color": activeThemePalette.terminal_scrollbar_hover,
      "--terminal-scrollbar-target-width": `${activeThemePalette.terminal_scrollbar_width}px`,
      "--topbar-sidebar-width": `${sidebarWidth}px`,
    } as React.CSSProperties;
  }, [activeThemePalette, sidebarWidth]);

  const selectedSessionContext = useMemo(() => {
    if (!selectedSessionId) {
      return null;
    }

    return sessionLookupMap.get(selectedSessionId) || null;
  }, [selectedSessionId, sessionLookupMap]);

  const currentSessionName = useMemo(() => {
    if (!selectedSessionContext) {
      return "";
    }

    return formatSessionLabel(selectedSessionContext.session);
  }, [selectedSessionContext, sessionAliases]);

  const parsedUpdateReleaseNotes = useMemo(() => {
    return parseUpdateReleaseNotes(updateState.metadata?.release_notes ?? "");
  }, [updateState.metadata?.release_notes]);

  const updatePublishedAtLabel = useMemo(() => {
    return formatPublishedDate(updateState.metadata?.published_at ?? "", appLanguage);
  }, [appLanguage, updateState.metadata?.published_at]);

  const handleTerminalOutput = useCallback(
    (sessionId: string, data: string) => {
      if (!data) {
        return;
      }

      if (!autoConfirmedTrustPromptRef.current.has(sessionId)) {
        const previousTrustOutput = workspaceTrustOutputBufferRef.current.get(sessionId) ?? "";
        const combinedTrustOutput = `${previousTrustOutput}${data}`.slice(
          -WORKSPACE_TRUST_OUTPUT_BUFFER_LIMIT
        );
        workspaceTrustOutputBufferRef.current.set(sessionId, combinedTrustOutput);

        const autoResponse = getClaudeAutoResponseForOutput(combinedTrustOutput);
        if (autoResponse) {
          autoConfirmedTrustPromptRef.current.add(sessionId);
          workspaceTrustOutputBufferRef.current.delete(sessionId);
          void writePty(sessionId, autoResponse).catch(() => {});
        }
      }

      if (sessionId.startsWith("__plain__")) {
        return;
      }

      const matchedSession = sessionLookupMap.get(sessionId);
      if (!matchedSession) {
        return;
      }

      const sanitizedChunk = stripAnsiSequences(data);
      if (!sanitizedChunk) {
        return;
      }

      const previousOutput = invalidSessionOutputBufferRef.current.get(sessionId) ?? "";
      const combinedOutput = `${previousOutput}${sanitizedChunk}`.slice(
        -INVALID_SESSION_OUTPUT_BUFFER_LIMIT
      );
      invalidSessionOutputBufferRef.current.set(sessionId, combinedOutput);

      if (!INVALID_CLAUDE_SESSION_OUTPUT_PATTERN.test(combinedOutput)) {
        return;
      }

      invalidSessionOutputBufferRef.current.delete(sessionId);

      setHiddenClaudeSessions((previous) => {
        return hideClaudeSession(previous, matchedSession.session);
      });
      setLastOpenedSession((previous) => {
        if (previous?.session_id === sessionId) {
          return null;
        }

        return previous;
      });
      setStatusMessage(t("status_session_hidden_invalid"));
      setSelectedSessionId((previous) => (previous === sessionId ? null : previous));
      setActiveTerminalId((previous) => (previous === sessionId ? null : previous));
      setOpenTerminalSessionIds((previous) => {
        if (!previous.has(sessionId)) {
          return previous;
        }

        const next = new Set(previous);
        next.delete(sessionId);
        return next;
      });
      void closePty(sessionId).catch(() => {});
    },
    [closePty, sessionLookupMap, t, writePty]
  );

  const projectTreeView = useMemo(() => {
    return projects.map((project) => {
      const allSessions = filteredSessionsByProject[project.id] || [];
      const isShowingAll = showAllSessions[project.id] ?? false;

      return {
        project,
        allSessions,
        isShowingAll,
        visibleSessions: isShowingAll
          ? allSessions
          : allSessions.slice(0, DEFAULT_VISIBLE_SESSIONS),
        hasMore: allSessions.length > DEFAULT_VISIBLE_SESSIONS,
      };
    });
  }, [projects, filteredSessionsByProject, showAllSessions]);

  return (
    <div
      className={`project-dashboard theme-${themeMode} ${
        isThemeTransitioning ? "theme-transitioning" : ""
      } ${
        isDraggingDivider ? "sidebar-resizing" : ""
      }`}
      style={dashboardThemeStyle}
    >
      <div
        className="drag-region"
        data-tauri-drag-region
        onMouseDown={handleWindowTopDragMouseDown}
      >
        <div className="window-top-controls">
          <button
            className="window-top-btn"
            onClick={() => setIsSidebarCollapsed((previous) => !previous)}
            title={isSidebarCollapsed ? t("title_show_sidebar") : t("title_hide_sidebar")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
          <button
            className="window-top-btn"
            onClick={() => {
              setActiveSettingsPanel("claude");
              setIsStartupSettingsOpen(true);
            }}
            title={t("title_settings_shortcut")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </button>
          <button
            className="window-top-btn"
            onClick={handleQuickThemeToggle}
            title={themeMode === "dark" ? t("title_switch_to_light") : t("title_switch_to_dark")}
          >
            {themeMode === "dark" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button
            className="window-top-btn"
            onClick={() => void handleQuickCreateProject()}
            title={t("title_add_project")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
        {selectedSessionContext && (
          <div
            className="window-top-session-wrap"
            title={currentSessionName}
            data-tauri-drag-region
          >
            <span className="window-top-session-name">{currentSessionName}</span>
            <span className="session-menu-wrap window-top-session-menu">
              <button
                className="session-more-trigger"
                onClick={(event) =>
                  handleToggleSessionMenu(event, selectedSessionContext.session.session_id)
                }
                title={t("title_session_actions")}
                aria-expanded={activeSessionMenuId === selectedSessionContext.session.session_id}
              >
                ...
              </button>
              {activeSessionMenuId === selectedSessionContext.session.session_id && (
                <div
                  className="session-action-menu top-session-action-menu"
                  onClick={(event) => event.stopPropagation()}
                >
                  {renderSessionActionMenu(
                    selectedSessionContext.project,
                    selectedSessionContext.session
                  )}
                </div>
              )}
            </span>
          </div>
        )}
      </div>

      {isStartupSettingsOpen && (
        <div className="startup-settings-overlay" onClick={() => setIsStartupSettingsOpen(false)}>
          <div className="startup-settings-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="startup-settings-header">
              <h3>{t("settings_title")}</h3>
              <button
                className="startup-settings-close"
                onClick={() => setIsStartupSettingsOpen(false)}
                aria-label={t("aria_close_settings")}
              >
                ×
              </button>
            </div>

            <div className="startup-settings-layout">
              <div className="startup-settings-nav">
                <button
                  className={`startup-settings-nav-item ${
                    activeSettingsPanel === "claude" ? "active" : ""
                  }`}
                  onClick={() => setActiveSettingsPanel("claude")}
                >
                  {t("nav_claude")}
                </button>
                <button
                  className={`startup-settings-nav-item ${
                    activeSettingsPanel === "appearance" ? "active" : ""
                  }`}
                  onClick={() => setActiveSettingsPanel("appearance")}
                >
                  {t("nav_appearance")}
                </button>
                <button
                  className={`startup-settings-nav-item ${
                    activeSettingsPanel === "integrations" ? "active" : ""
                  }`}
                  onClick={() => setActiveSettingsPanel("integrations")}
                >
                  {t("nav_integrations")}
                </button>
              </div>

              <div className="startup-settings-content">
                {activeSettingsPanel === "appearance" && (
                  <div className="startup-settings-section">
                    <div className="startup-settings-section-title">{t("section_language")}</div>
                    <select
                      className="startup-settings-select"
                      value={appLanguage}
                      onChange={(event) => setAppLanguage(resolveAppLanguage(event.target.value))}
                    >
                      <option value="zh-CN">{t("language_zh_cn")}</option>
                      <option value="en-US">{t("language_en_us")}</option>
                    </select>

                    <div className="startup-settings-section-title">{t("section_theme_preset")}</div>
                    <select
                      className="startup-settings-select"
                      value={themePreset}
                      onChange={(event) => setThemePreset(normalizeThemePreset(event.target.value))}
                    >
                      <option value="default">{t("theme_preset_default")}</option>
                      <option value="everforest">{t("theme_preset_everforest")}</option>
                    </select>
                    <p className="startup-settings-hint">{t("hint_theme_preset")}</p>

                    <div className="startup-settings-section-title">{t("section_theme_mode")}</div>
                    <div className="startup-settings-theme-options">
                      <label className="startup-settings-theme-option">
                        <input
                          type="radio"
                          name="theme-preference"
                          value="light"
                          checked={themePreference === "light"}
                          onChange={() => setThemePreference("light")}
                        />
                        <span>{t("theme_light")}</span>
                      </label>
                      <label className="startup-settings-theme-option">
                        <input
                          type="radio"
                          name="theme-preference"
                          value="dark"
                          checked={themePreference === "dark"}
                          onChange={() => setThemePreference("dark")}
                        />
                        <span>{t("theme_dark")}</span>
                      </label>
                      <label className="startup-settings-theme-option">
                        <input
                          type="radio"
                          name="theme-preference"
                          value="system"
                          checked={themePreference === "system"}
                          onChange={() => setThemePreference("system")}
                        />
                        <span>{t("theme_system")}</span>
                      </label>
                    </div>
                    <p className="startup-settings-hint">
                      {themePreset === "default"
                        ? t("hint_theme_palette_default")
                        : t("hint_theme_palette_builtin")}
                    </p>
                  </div>
                )}

                {activeSettingsPanel === "integrations" && (
                  <div className="startup-settings-section">
                    <div className="startup-settings-section-title">{t("section_external_terminal")}</div>
                    <select
                      className="startup-settings-select"
                      value={defaultExternalTerminal}
                      onChange={(event) => setDefaultExternalTerminal(event.target.value)}
                    >
                      {availableExternalTerminals.map((terminalName) => (
                        <option key={terminalName} value={terminalName}>
                          {terminalName}
                        </option>
                      ))}
                    </select>

                    <div className="startup-settings-section-title">{t("section_external_editor")}</div>
                    <select
                      className="startup-settings-select"
                      value={defaultExternalEditor}
                      onChange={(event) => setDefaultExternalEditor(event.target.value)}
                    >
                      {availableExternalEditors.map((editorName) => (
                        <option key={editorName} value={editorName}>
                          {editorName}
                        </option>
                      ))}
                    </select>

                    <p className="startup-settings-hint">{t("hint_integrations")}</p>
                  </div>
                )}

                {activeSettingsPanel === "claude" && (
                  <div className="startup-settings-section">
                    <div className="startup-settings-section-title">{t("section_claude_startup")}</div>
                    <label className="startup-settings-toggle-row">
                      <input
                        type="checkbox"
                        checked={claudeStartupSettings.enabled}
                        onChange={(event) => handleToggleCustomClaudeArgs(event.target.checked)}
                      />
                      <span>{t("label_enable_custom_args")}</span>
                    </label>

                    <input
                      className="startup-settings-input"
                      value={claudeStartupSettings.customArgs}
                      onChange={(event) =>
                        setClaudeStartupSettings((previous) => ({
                          ...previous,
                          customArgs: event.target.value,
                        }))
                      }
                      disabled={!claudeStartupSettings.enabled}
                      placeholder={DEFAULT_CLAUDE_CUSTOM_ARGS}
                      spellCheck={false}
                    />

                    <p className="startup-settings-hint">{t("hint_claude_startup")}</p>

                    <div className="startup-settings-section-title">{t("section_session_restore")}</div>
                    <label className="startup-settings-toggle-row">
                      <input
                        type="checkbox"
                        checked={restoreLastOpenedSession}
                        onChange={(event) => setRestoreLastOpenedSession(event.target.checked)}
                      />
                      <span>{t("label_restore_last_session")}</span>
                    </label>
                    <p className="startup-settings-hint">{t("hint_restore_last_session")}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="startup-settings-actions">
              <button
                className="startup-settings-done"
                onClick={() => setIsStartupSettingsOpen(false)}
              >
                {t("button_done")}
              </button>
            </div>
          </div>
        </div>
      )}

      <UpdateDialog
        isOpen={isUpdateDialogOpen}
        state={updateState}
        publishedAtLabel={updatePublishedAtLabel}
        changelogRows={parsedUpdateReleaseNotes.changelogRows}
        summaryNotes={parsedUpdateReleaseNotes.summaryNotes}
        downloadedPath={downloadedUpdate?.downloaded_path ?? ""}
        canClose={updateState.phase !== "checking" && updateState.phase !== "downloading"}
        t={t}
        onClose={handleCloseUpdateDialog}
        onDownload={handleDownloadUpdate}
        onOpenRelease={handleOpenUpdateRelease}
      />

      {error && <div className="global-error">{error}</div>}
      {statusMessage && <div className="global-status">{statusMessage}</div>}

      <div className="dashboard-container">
        <aside
          className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}
          style={{ width: `${sidebarWidth}px` }}
        >
          {!isSidebarCollapsed && (
            <>
              <div className="project-tree">
                {projectTreeView.map(({ project, allSessions, isShowingAll, visibleSessions, hasMore }) => {
                  const isSelectedProject = selectedProjectId === project.id;
                  const isExpanded = expandedProjects[project.id] ?? false;

                  return (
                    <div key={project.id} className="tree-project-block">
                      <div
                        className={`tree-project-row ${isSelectedProject ? "selected" : ""} ${
                          draggingProjectId === project.id ? "dragging" : ""
                        } ${
                          dragOverProjectId === project.id && draggingProjectId !== project.id
                            ? "drag-over"
                            : ""
                        }`}
                        draggable
                        onDragStart={(event) => handleProjectDragStart(event, project.id)}
                        onDragOver={(event) => handleProjectDragOver(event, project.id)}
                        onDrop={(event) => handleProjectDrop(event, project.id)}
                        onDragEnd={handleProjectDragEnd}
                        onClick={() => {
                          setActiveSessionMenuId(null);
                          setSelectedProjectId(project.id);
                          setSelectedSessionId(null);
                          toggleProjectExpanded(project.id);
                        }}
                      >
                        <button
                          className="expand-toggle"
                          draggable={false}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleProjectExpanded(project.id);
                          }}
                        >
                          {isExpanded ? "▾" : "▸"}
                        </button>
                        <span className="tree-project-name-wrap">
                          <span className="tree-project-name" title={project.name}>
                            {project.name}
                          </span>
                          <button
                            className="project-delete-corner"
                            draggable={false}
                            onClick={(event) => void handleDeleteProject(event, project)}
                            title={t("title_remove_project_sidebar")}
                          >
                            ✗
                          </button>
                        </span>
                        {allSessions.length > 0 && (
                          <span className="tree-project-count">{allSessions.length}</span>
                        )}
                        <span className="project-row-actions">
                          <button
                            className="project-action-btn"
                            draggable={false}
                            onClick={(event) => void handleQuickNewSession(event, project)}
                            title={t("title_quick_new_session")}
                          >
                            +
                          </button>
                        </span>
                      </div>

                      <div className={`tree-session-list-wrapper ${isExpanded ? "expanded" : ""}`}>
                        <div className="tree-session-list">
                          {allSessions.length === 0 && (
                            <div className="tree-empty">{t("tree_no_sessions")}</div>
                          )}

                          {visibleSessions.map((session) => {
                            const isSessionOpen = openTerminalSessionIds.has(session.session_id);
                            return (
                            <div
                              key={session.session_id}
                              className={`tree-session-row ${
                                selectedSessionId === session.session_id ? "selected" : ""
                              } ${editingSessionId === session.session_id ? "editing" : ""}`}
                              onClick={() => {
                                setActiveSessionMenuId(null);
                                setSelectedProjectId(project.id);
                                setSelectedSessionId(session.session_id);
                                ensureClaudeSessionTerminalActive(session.session_id);
                              }}
                              title={formatSessionLabel(session)}
                            >
                              <span className={`session-dot ${isSessionOpen ? "open" : ""}`}>
                                {isSessionOpen ? "●" : "•"}
                              </span>
                              {editingSessionId === session.session_id ? (
                                <input
                                  className="session-name-input"
                                  value={sessionNameDraft}
                                  maxLength={80}
                                  autoFocus
                                  onChange={(event) => setSessionNameDraft(event.target.value)}
                                  onClick={(event) => event.stopPropagation()}
                                  onBlur={() => void saveEditingSessionLabel(session)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void saveEditingSessionLabel(session);
                                    }

                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      cancelEditingSessionLabel();
                                    }
                                  }}
                                />
                              ) : (
                                <span className="tree-session-main">
                                  <span className="tree-session-name">
                                    {formatSessionLabel(session)}
                                  </span>
                                </span>
                              )}
                              <span className="tree-session-time">
                                {formatSessionTime(session.modified)}
                              </span>
                              {editingSessionId !== session.session_id && (
                                <span className="tree-session-actions" onClick={(event) => event.stopPropagation()}>
                                  <button
                                    className="tree-session-action-btn edit"
                                    onClick={(event) =>
                                      startEditingSessionLabel(event, project.id, session)
                                    }
                                    title={t("menu_edit_session_name")}
                                  >
                                    <span className="tree-session-action-glyph edit">✐</span>
                                  </button>
                                  {openTerminalSessionIds.has(session.session_id) && (
                                    <button
                                      className="tree-session-action-btn"
                                      onClick={() => void handleStopTerminal(session.session_id)}
                                      title={t("menu_stop")}
                                    >
                                      ■
                                    </button>
                                  )}
                                  <button
                                    className="tree-session-action-btn danger"
                                    onClick={() =>
                                      void handleDeleteSession(
                                        project.id,
                                        project.path,
                                        session.session_id
                                      )
                                    }
                                    title={t("menu_delete")}
                                  >
                                    ✕
                                  </button>
                                </span>
                              )}
                            </div>
                            );
                          })}

                          {hasMore && (
                            <button
                              className="show-more-btn"
                              onClick={(event) => {
                                event.stopPropagation();
                                setShowAllSessions((prev) => ({
                                  ...prev,
                                  [project.id]: !prev[project.id],
                                }));
                              }}
                            >
                              {isShowingAll
                                ? t("show_less")
                                : t("show_more_count", {
                                    count: allSessions.length - DEFAULT_VISIBLE_SESSIONS,
                                  })}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {projects.length === 0 && <div className="tree-empty">{t("tree_no_projects")}</div>}
              </div>
            </>
          )}

          {!isSidebarCollapsed && (
            <div
              className={`sidebar-resize-handle ${isDraggingDivider ? "dragging" : ""}`}
              onMouseDown={handleMouseDownDivider}
              title={t("title_drag_resize_sidebar")}
            />
          )}
        </aside>

        <div className="terminal-area">
          <div className="terminal-wrapper">
            {openTerminalIds.map((id) => (
              <EmbeddedTerminal
                key={id}
                sessionId={id}
                workingDir={getWorkingDir(id)}
                visible={id === activeTerminalId}
                isDark={themeMode === "dark"}
                themePalette={terminalThemePalette}
                claudeArgs={customClaudeArgs}
                onOutput={handleTerminalOutput}
              />
            ))}
            {openTerminalSessionIds.size === 0 && (
              <div className="workspace-placeholder">
                <p>{t("workspace_placeholder")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
