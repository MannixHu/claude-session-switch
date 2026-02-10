import { listen, type UnlistenFn } from "@tauri-apps/api/event";

type SessionHandler = (data: string) => void;


const PTY_EVENT_DEBUG = (() => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem("ccsm.debug.terminal") === "1";
  } catch {
    return false;
  }
})();

const ptyBusDebugLog = (message: string, details?: unknown) => {
  if (!PTY_EVENT_DEBUG) {
    return;
  }

  if (details === undefined) {
    console.info(`[ptyEventBus] ${message}`);
    return;
  }

  console.info(`[ptyEventBus] ${message}`, details);
};

const listeners = new Map<string, Set<SessionHandler>>();
let stopGlobalListener: UnlistenFn | null = null;
let listenerReady: Promise<void> | null = null;

async function ensureGlobalListener(): Promise<void> {
  if (stopGlobalListener) {
    return;
  }

  if (!listenerReady) {
    listenerReady = (async () => {
      try {
        const unlisten = await listen<{ session_id: string; data: string }>(
          "pty-output",
          (event) => {
            const sessionId = event.payload.session_id;
            const handlers = listeners.get(sessionId);
            if (!handlers || handlers.size === 0) {
              return;
            }

            for (const handler of handlers) {
              handler(event.payload.data);
            }
          }
        );

        stopGlobalListener = unlisten;
        ptyBusDebugLog("global listener attached");
      } catch (error) {
        listenerReady = null;
        throw error;
      }
    })();
  }

  await listenerReady;
}

async function maybeDisposeGlobalListener(): Promise<void> {
  if (listeners.size > 0) {
    return;
  }

  if (stopGlobalListener) {
    stopGlobalListener();
    stopGlobalListener = null;
    ptyBusDebugLog("global listener disposed");
  }

  listenerReady = null;
}

export async function subscribePtyOutput(
  sessionId: string,
  handler: SessionHandler
): Promise<() => void> {
  if (!sessionId.trim()) {
    throw new Error("Session id is required for PTY subscription");
  }

  await ensureGlobalListener();

  const handlers = listeners.get(sessionId) ?? new Set<SessionHandler>();
  handlers.add(handler);
  listeners.set(sessionId, handlers);
  ptyBusDebugLog("session subscribed", { sessionId, handlers: handlers.size });

  return () => {
    const currentHandlers = listeners.get(sessionId);
    if (!currentHandlers) {
      return;
    }

    currentHandlers.delete(handler);
    if (currentHandlers.size === 0) {
      listeners.delete(sessionId);
      ptyBusDebugLog("session unsubscribed", { sessionId, handlers: 0 });
      void maybeDisposeGlobalListener();
    }
  };
}
