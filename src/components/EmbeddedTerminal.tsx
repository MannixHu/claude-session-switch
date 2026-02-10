import { useCallback, useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { invoke } from "@tauri-apps/api/core";
import { subscribePtyOutput } from "../lib/ptyEventBus";
import "@xterm/xterm/css/xterm.css";
import "./EmbeddedTerminal.css";

interface EmbeddedTerminalThemePalette {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  scrollbar: string;
  scrollbarHover: string;
}

interface EmbeddedTerminalProps {
  sessionId: string;
  workingDir: string;
  visible: boolean;
  isDark: boolean;
  themePalette?: EmbeddedTerminalThemePalette;
  claudeArgs?: string[];
}

const SCROLLBAR_HIDE_DELAY_MS = 620;
const SCROLLABLE_STATE_THROTTLE_MS = 140;
const PTY_WRITE_FLUSH_DELAY_MS = 12;
const PTY_RESIZE_FLUSH_DELAY_MS = 48;
const PTY_RENDER_FLUSH_CHUNK_SIZE_VISIBLE = 64 * 1024;
const PTY_RENDER_FLUSH_CHUNK_SIZE_HIDDEN = 160 * 1024;
const PTY_RENDER_HIDDEN_FLUSH_DELAY_MS = 42;

const DEFAULT_TERMINAL_THEMES = {
  dark: {
    background: "#002b36",
    foreground: "#839496",
    cursor: "#93a1a1",
    selectionBackground: "#073642",
    scrollbar: "rgba(88, 110, 117, 0.48)",
    scrollbarHover: "rgba(88, 110, 117, 0.66)",
  },
  light: {
    background: "#fafafb",
    foreground: "#4f5a63",
    cursor: "#4f5a63",
    selectionBackground: "#e9eaed",
    scrollbar: "rgba(88, 96, 105, 0.34)",
    scrollbarHover: "rgba(88, 96, 105, 0.52)",
  },
} satisfies Record<"dark" | "light", EmbeddedTerminalThemePalette>;

const normalizeThemePalette = (
  isDark: boolean,
  themePalette?: EmbeddedTerminalThemePalette
): EmbeddedTerminalThemePalette => {
  const fallback = isDark ? DEFAULT_TERMINAL_THEMES.dark : DEFAULT_TERMINAL_THEMES.light;

  if (!themePalette) {
    return fallback;
  }

  const valueOrFallback = (value: string, defaultValue: string) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : defaultValue;
  };

  return {
    background: valueOrFallback(themePalette.background, fallback.background),
    foreground: valueOrFallback(themePalette.foreground, fallback.foreground),
    cursor: valueOrFallback(themePalette.cursor, fallback.cursor),
    selectionBackground: valueOrFallback(themePalette.selectionBackground, fallback.selectionBackground),
    scrollbar: valueOrFallback(themePalette.scrollbar, fallback.scrollbar),
    scrollbarHover: valueOrFallback(themePalette.scrollbarHover, fallback.scrollbarHover),
  };
};

const TERMINAL_DEBUG = (() => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const debugFlag = (window as { __CCSM_DEBUG_TERMINAL__?: boolean }).__CCSM_DEBUG_TERMINAL__;
    return debugFlag === true || window.localStorage.getItem("ccsm.debug.terminal") === "1";
  } catch {
    return false;
  }
})();

const terminalDebugLog = (sessionId: string, message: string, details?: unknown) => {
  if (!TERMINAL_DEBUG) {
    return;
  }

  if (details === undefined) {
    console.info(`[EmbeddedTerminal:${sessionId}] ${message}`);
    return;
  }

  console.info(`[EmbeddedTerminal:${sessionId}] ${message}`, details);
};

const openExternalUrl = async (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) {
    return;
  }

  try {
    await invoke("open_external_url", { url: trimmed });
    return;
  } catch {
    // fallback to browser open in web context
  }

  try {
    window.open(trimmed, "_blank", "noopener,noreferrer");
  } catch {
    // no-op
  }
};

export default function EmbeddedTerminal({
  sessionId,
  workingDir,
  visible,
  isDark,
  themePalette,
  claudeArgs = [],
}: EmbeddedTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const scrollbarHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportCleanupRef = useRef<(() => void) | null>(null);
  const scrollUpdateFrameRef = useRef<number | null>(null);
  const writeBufferRef = useRef("");
  const writeFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingResizeRef = useRef<{ cols: number; rows: number } | null>(null);
  const ptyRenderBufferRef = useRef("");
  const ptyRenderFrameRef = useRef<number | null>(null);
  const ptyRenderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(visible);
  const listenerReadyRef = useRef(false);
  const hasReceivedPtyOutputRef = useRef(false);
  const ptyCreateInFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const fitTerminal = () => {
    if (!fitAddonRef.current || !terminalRef.current || !containerRef.current) {
      return;
    }

    if (!containerRef.current.classList.contains("visible")) {
      return;
    }

    requestAnimationFrame(() => {
      try {
        fitAddonRef.current?.fit();
        terminalRef.current?.focus();
      } catch {
        // ignore transient fit/focus errors
      }
    });
  };

  const applyTerminalTheme = () => {
    const theme = normalizeThemePalette(isDark, themePalette);

    if (containerRef.current) {
      containerRef.current.style.setProperty("--terminal-scrollbar-color", theme.scrollbar);
      containerRef.current.style.setProperty("--terminal-scrollbar-hover-color", theme.scrollbarHover);
    }

    if (terminalRef.current) {
      terminalRef.current.options.theme = {
        background: theme.background,
        foreground: theme.foreground,
        cursor: theme.cursor,
        selectionBackground: theme.selectionBackground,
      };
    }
  };

  const buildPtyPayload = useCallback(() => {
    const shouldResumeClaude = !sessionId.startsWith("__plain__");
    const normalizedClaudeArgs = claudeArgs
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const allowDangerouslySkipPermissions = normalizedClaudeArgs.includes(
      "--dangerously-skip-permissions"
    );

    return {
      session_id: sessionId,
      working_dir: workingDir,
      enable_claude_resume: shouldResumeClaude,
      resume_session_id: shouldResumeClaude ? sessionId : null,
      claude_args: shouldResumeClaude ? normalizedClaudeArgs : null,
      allow_dangerously_skip_permissions:
        shouldResumeClaude && allowDangerouslySkipPermissions,
    };
  }, [claudeArgs, sessionId, workingDir]);

  const ensurePtySession = useCallback(
    async (reason: string) => {
      const payload = buildPtyPayload();
      if (!payload.working_dir.trim()) {
        terminalDebugLog(sessionId, "skip create_pty due empty working dir", { reason });
        return;
      }

      if (ptyCreateInFlightRef.current) {
        await ptyCreateInFlightRef.current;
        return;
      }

      const pending = (async () => {
        terminalDebugLog(sessionId, "invoking create_pty", {
          reason,
          workingDir: payload.working_dir,
          resume: payload.enable_claude_resume,
        });

        try {
          await invoke("create_pty", payload);
          terminalDebugLog(sessionId, "create_pty resolved", { reason });
        } catch (error) {
          console.error(`[EmbeddedTerminal:${sessionId}] create_pty failed`, error);
          terminalRef.current?.write(
            `\r\n\x1b[31mFailed to create PTY: ${String(error)}\x1b[0m\r\n`
          );
        }
      })();

      ptyCreateInFlightRef.current = pending;

      try {
        await pending;
      } finally {
        if (ptyCreateInFlightRef.current === pending) {
          ptyCreateInFlightRef.current = null;
        }
      }
    },
    [buildPtyPayload, sessionId]
  );

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const initialTheme = normalizeThemePalette(isDark, themePalette);

    const terminal = new Terminal({
      theme: {
        background: initialTheme.background,
        foreground: initialTheme.foreground,
        cursor: initialTheme.cursor,
        selectionBackground: initialTheme.selectionBackground,
      },
      fontFamily:
        '"SF Mono", "SFMono-Regular", ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.18,
      letterSpacing: 0,
      cursorBlink: true,
      allowProposedApi: true,
      convertEol: false,
      scrollback: 6000,
      scrollOnUserInput: true,
      smoothScrollDuration: 300,
      scrollSensitivity: 1,
      fastScrollSensitivity: 2.25,
    });

    const fitAddon = new FitAddon();
    const unicode11Addon = new Unicode11Addon();
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      event.preventDefault();
      event.stopPropagation();
      void openExternalUrl(uri);
    });

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(unicode11Addon);
    terminal.unicode.activeVersion = "11";

    terminal.open(containerRef.current);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    listenerReadyRef.current = false;
    hasReceivedPtyOutputRef.current = false;
    ptyCreateInFlightRef.current = null;

    terminalDebugLog(sessionId, "terminal mounted", {
      workingDir,
      visible: visibleRef.current,
    });

    applyTerminalTheme();

    let scrollDisposable: { dispose: () => void } | null = null;
    let scheduleScrollableStateUpdate: ((force?: boolean) => void) | null = null;
    const containerEl = containerRef.current;
    const viewport = containerEl.querySelector(".xterm-viewport") as HTMLElement | null;

    if (viewport) {
      let lastScrollableStateCheckAt = 0;

      const updateScrollableState = () => {
        const hasScrollableContent = viewport.scrollHeight > viewport.clientHeight + 1;
        containerEl.classList.toggle("has-scrollbar", hasScrollableContent);

        if (!hasScrollableContent) {
          containerEl.classList.remove("is-scrolling");
          if (scrollbarHideTimerRef.current) {
            clearTimeout(scrollbarHideTimerRef.current);
            scrollbarHideTimerRef.current = null;
          }
        }
      };

      scheduleScrollableStateUpdate = (force = false) => {
        const now = performance.now();
        if (
          !force &&
          now - lastScrollableStateCheckAt < SCROLLABLE_STATE_THROTTLE_MS
        ) {
          return;
        }

        if (scrollUpdateFrameRef.current !== null) {
          return;
        }

        scrollUpdateFrameRef.current = requestAnimationFrame(() => {
          scrollUpdateFrameRef.current = null;
          lastScrollableStateCheckAt = performance.now();
          updateScrollableState();
        });
      };

      const showScrollbar = () => {
        scheduleScrollableStateUpdate?.();

        if (!containerEl.classList.contains("has-scrollbar")) {
          scheduleScrollableStateUpdate?.(true);
          containerEl.classList.remove("is-scrolling");
          return;
        }

        containerEl.classList.add("is-scrolling");

        if (scrollbarHideTimerRef.current) {
          clearTimeout(scrollbarHideTimerRef.current);
        }

        scrollbarHideTimerRef.current = setTimeout(() => {
          containerEl.classList.remove("is-scrolling");
          scrollbarHideTimerRef.current = null;
        }, SCROLLBAR_HIDE_DELAY_MS);
      };

      const handleUserScroll = () => {
        showScrollbar();
      };

      const options: AddEventListenerOptions = { passive: true };
      viewport.addEventListener("wheel", handleUserScroll, options);
      viewport.addEventListener("scroll", handleUserScroll, options);
      viewport.addEventListener("touchmove", handleUserScroll, options);

      scrollDisposable = terminal.onScroll(() => {
        showScrollbar();
      });

      scheduleScrollableStateUpdate(true);

      viewportCleanupRef.current = () => {
        viewport.removeEventListener("wheel", handleUserScroll);
        viewport.removeEventListener("scroll", handleUserScroll);
        viewport.removeEventListener("touchmove", handleUserScroll);
        containerEl.classList.remove("has-scrollbar", "is-scrolling");
      };
    }

    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore first-frame fit race
      }
    });

    const clearPtyRenderSchedule = () => {
      if (ptyRenderFrameRef.current !== null) {
        cancelAnimationFrame(ptyRenderFrameRef.current);
        ptyRenderFrameRef.current = null;
      }

      if (ptyRenderTimerRef.current) {
        clearTimeout(ptyRenderTimerRef.current);
        ptyRenderTimerRef.current = null;
      }
    };

    const flushPtyRenderBuffer = () => {
      clearPtyRenderSchedule();

      if (!ptyRenderBufferRef.current) {
        return;
      }

      const chunkSize = visibleRef.current
        ? PTY_RENDER_FLUSH_CHUNK_SIZE_VISIBLE
        : PTY_RENDER_FLUSH_CHUNK_SIZE_HIDDEN;
      const nextChunk = ptyRenderBufferRef.current.slice(0, chunkSize);
      ptyRenderBufferRef.current = ptyRenderBufferRef.current.slice(nextChunk.length);

      terminal.write(nextChunk);
      if (visibleRef.current) {
        scheduleScrollableStateUpdate?.();
      }

      if (ptyRenderBufferRef.current) {
        schedulePtyRenderFlush();
      }
    };

    const schedulePtyRenderFlush = () => {
      if (ptyRenderFrameRef.current !== null || ptyRenderTimerRef.current) {
        return;
      }

      if (visibleRef.current) {
        ptyRenderFrameRef.current = requestAnimationFrame(() => {
          ptyRenderFrameRef.current = null;
          flushPtyRenderBuffer();
        });
        return;
      }

      ptyRenderTimerRef.current = setTimeout(() => {
        ptyRenderTimerRef.current = null;
        flushPtyRenderBuffer();
      }, PTY_RENDER_HIDDEN_FLUSH_DELAY_MS);
    };

    const queuePtyRender = (data: string) => {
      if (!data) {
        return;
      }

      ptyRenderBufferRef.current += data;
      schedulePtyRenderFlush();
    };

    const setupListener = async () => {
      const unlisten = await subscribePtyOutput(sessionId, (data) => {
        if (!hasReceivedPtyOutputRef.current) {
          hasReceivedPtyOutputRef.current = true;
          terminalDebugLog(sessionId, "received first PTY chunk", {
            bytes: data.length,
            visible: visibleRef.current,
          });
        }

        queuePtyRender(data);
      });
      unlistenRef.current = unlisten;
      listenerReadyRef.current = true;
      terminalDebugLog(sessionId, "PTY listener attached");
    };

    const flushPtyWriteBuffer = () => {
      if (writeFlushTimerRef.current) {
        clearTimeout(writeFlushTimerRef.current);
        writeFlushTimerRef.current = null;
      }

      const payload = writeBufferRef.current;
      if (!payload) {
        return;
      }

      writeBufferRef.current = "";
      invoke("write_pty", { session_id: sessionId, data: payload }).catch(() => {});
    };

    const queuePtyWrite = (data: string) => {
      writeBufferRef.current += data;
      if (writeFlushTimerRef.current) {
        return;
      }

      writeFlushTimerRef.current = setTimeout(() => {
        flushPtyWriteBuffer();
      }, PTY_WRITE_FLUSH_DELAY_MS);
    };

    const flushResize = () => {
      if (resizeFlushTimerRef.current) {
        clearTimeout(resizeFlushTimerRef.current);
        resizeFlushTimerRef.current = null;
      }

      const pending = pendingResizeRef.current;
      if (!pending) {
        return;
      }

      pendingResizeRef.current = null;
      invoke("resize_pty", { session_id: sessionId, cols: pending.cols, rows: pending.rows }).catch(
        () => {}
      );
    };

    const queueResize = (cols: number, rows: number) => {
      pendingResizeRef.current = { cols, rows };
      if (resizeFlushTimerRef.current) {
        return;
      }

      resizeFlushTimerRef.current = setTimeout(() => {
        flushResize();
      }, PTY_RESIZE_FLUSH_DELAY_MS);
    };

    const dataDisposable = terminal.onData((data) => {
      queuePtyWrite(data);
    });

    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      queueResize(cols, rows);
    });

    let fitTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFit = () => {
      if (fitTimer) {
        clearTimeout(fitTimer);
      }
      fitTimer = setTimeout(() => {
        fitTerminal();
      }, 60);
    };

    const observer = new ResizeObserver(debouncedFit);
    observer.observe(containerRef.current);
    observerRef.current = observer;

    const initialFitTimer = setTimeout(() => {
      fitTerminal();
    }, 140);

    let disposed = false;

    void (async () => {
      try {
        await setupListener();
      } catch (error) {
        console.error(`[EmbeddedTerminal:${sessionId}] failed to subscribe PTY output`, error);
        terminal.write(
          `\r\n\x1b[31mFailed to subscribe PTY output: ${String(error)}\x1b[0m\r\n`
        );
        return;
      }

      if (disposed) {
        return;
      }

      await ensurePtySession("mount");

      if (!disposed) {
        window.setTimeout(() => {
          if (!hasReceivedPtyOutputRef.current) {
            terminalDebugLog(sessionId, "no PTY output yet after create_pty", {
              workingDir,
              visible: visibleRef.current,
              listenerReady: listenerReadyRef.current,
            });
          }
        }, 1600);
      }
    })();

    return () => {
      disposed = true;
      clearTimeout(initialFitTimer);
      if (fitTimer) {
        clearTimeout(fitTimer);
      }

      dataDisposable.dispose();
      resizeDisposable.dispose();

      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }

      if (scrollDisposable) {
        scrollDisposable.dispose();
      }

      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (scrollbarHideTimerRef.current) {
        clearTimeout(scrollbarHideTimerRef.current);
        scrollbarHideTimerRef.current = null;
      }

      if (viewportCleanupRef.current) {
        viewportCleanupRef.current();
        viewportCleanupRef.current = null;
      }

      if (scrollUpdateFrameRef.current !== null) {
        cancelAnimationFrame(scrollUpdateFrameRef.current);
        scrollUpdateFrameRef.current = null;
      }

      if (ptyRenderFrameRef.current !== null) {
        cancelAnimationFrame(ptyRenderFrameRef.current);
        ptyRenderFrameRef.current = null;
      }

      if (ptyRenderTimerRef.current) {
        clearTimeout(ptyRenderTimerRef.current);
        ptyRenderTimerRef.current = null;
      }

      if (writeFlushTimerRef.current) {
        clearTimeout(writeFlushTimerRef.current);
        writeFlushTimerRef.current = null;
      }

      if (resizeFlushTimerRef.current) {
        clearTimeout(resizeFlushTimerRef.current);
        resizeFlushTimerRef.current = null;
      }

      if (writeBufferRef.current) {
        void invoke("write_pty", { session_id: sessionId, data: writeBufferRef.current }).catch(
          () => {}
        );
      }

      if (pendingResizeRef.current) {
        const pending = pendingResizeRef.current;
        void invoke("resize_pty", { session_id: sessionId, cols: pending.cols, rows: pending.rows }).catch(
          () => {}
        );
      }

      writeBufferRef.current = "";
      pendingResizeRef.current = null;
      ptyRenderBufferRef.current = "";
      ptyCreateInFlightRef.current = null;
      listenerReadyRef.current = false;
      hasReceivedPtyOutputRef.current = false;

      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [ensurePtySession, sessionId]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const handleResize = () => {
      fitTerminal();
    };

    window.addEventListener("resize", handleResize);

    let ensurePtyTimer: ReturnType<typeof setTimeout> | null = null;
    let ensurePtyCancelled = false;
    let ensurePtyRetries = 0;

    const ensurePtyWhenListenerReady = () => {
      if (ensurePtyCancelled) {
        return;
      }

      if (!listenerReadyRef.current) {
        ensurePtyRetries += 1;
        if (ensurePtyRetries <= 24) {
          ensurePtyTimer = setTimeout(ensurePtyWhenListenerReady, 40);
        }
        return;
      }

      void ensurePtySession("visible");
    };

    ensurePtyWhenListenerReady();

    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const ensureFitWithRetry = () => {
      fitTerminal();

      const container = containerRef.current;
      const terminal = terminalRef.current;
      const hasValidSize =
        !!container && container.clientWidth > 2 && container.clientHeight > 2;
      const hasValidGrid = !!terminal && terminal.cols > 2 && terminal.rows > 1;

      if (hasValidSize && hasValidGrid) {
        return;
      }

      retries += 1;
      if (retries <= 8) {
        retryTimer = setTimeout(ensureFitWithRetry, 85);
      }
    };

    ensureFitWithRetry();

    return () => {
      ensurePtyCancelled = true;
      if (ensurePtyTimer) {
        clearTimeout(ensurePtyTimer);
      }
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      window.removeEventListener("resize", handleResize);
    };
  }, [ensurePtySession, visible, sessionId]);

  useEffect(() => {
    applyTerminalTheme();
    fitTerminal();
  }, [isDark, themePalette]);

  return (
    <div
      ref={containerRef}
      className={`embedded-terminal ${visible ? "visible" : ""}`}
    />
  );
}
