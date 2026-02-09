import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "@xterm/xterm/css/xterm.css";
import "./EmbeddedTerminal.css";

interface EmbeddedTerminalProps {
  sessionId: string;
  workingDir: string;
  visible: boolean;
  isDark: boolean;
}

const DARK_THEME = {
  background: "#0f172a",
  foreground: "#e2e8f0",
  cursor: "#e2e8f0",
  selectionBackground: "#334155",
};

const LIGHT_THEME = {
  background: "#f8fafc",
  foreground: "#0f172a",
  cursor: "#0f172a",
  selectionBackground: "#cbd5e1",
};

export default function EmbeddedTerminal({
  sessionId,
  workingDir,
  visible,
  isDark,
}: EmbeddedTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  // Create terminal on mount / when sessionId changes
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: isDark ? DARK_THEME : LIGHT_THEME,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Fit after opening
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    // Listen for PTY output from Rust
    let unlisten: (() => void) | null = null;
    const setupListener = async () => {
      unlisten = await listen<{ session_id: string; data: string }>(
        "pty-output",
        (event) => {
          if (event.payload.session_id === sessionId) {
            term.write(event.payload.data);
          }
        }
      );
      unlistenRef.current = unlisten;
    };
    setupListener();

    // Send input to PTY
    const dataDisposable = term.onData((data) => {
      invoke("write_pty", { session_id: sessionId, data }).catch(() => {});
    });

    // Send resize to PTY
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      invoke("resize_pty", { session_id: sessionId, cols, rows }).catch(
        () => {}
      );
    });

    // Auto-fit on container resize (observe parent to avoid feedback loop)
    const parentEl = containerRef.current.parentElement;
    let fitTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFit = () => {
      if (fitTimer) clearTimeout(fitTimer);
      fitTimer = setTimeout(() => {
        try { fitAddon.fit(); } catch { /* ignore */ }
      }, 50);
    };
    const observer = new ResizeObserver(debouncedFit);
    if (parentEl) observer.observe(parentEl);
    observerRef.current = observer;

    // Create the PTY process
    const startPty = async () => {
      try {
        await invoke("create_pty", {
          session_id: sessionId,
          working_dir: workingDir,
        });
        // For claude sessions, send the resume command
        if (!sessionId.startsWith("__plain__")) {
          await invoke("write_pty", {
            session_id: sessionId,
            data:
              "claude --dangerously-skip-permissions --resume " +
              sessionId +
              "\r",
          });
        }
      } catch (err) {
        term.write(
          "\r\n\x1b[31mFailed to create PTY: " + String(err) + "\x1b[0m\r\n"
        );
      }
    };
    startPty();

    return () => {
      dataDisposable.dispose();
      resizeDisposable.dispose();
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle visibility changes
  useEffect(() => {
    if (visible && fitAddonRef.current && terminalRef.current) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
        terminalRef.current?.focus();
      });
    }
  }, [visible]);

  // Handle theme changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = isDark ? DARK_THEME : LIGHT_THEME;
    }
  }, [isDark]);

  return (
    <div
      ref={containerRef}
      className="embedded-terminal"
      style={{ display: visible ? "block" : "none" }}
    />
  );
}
