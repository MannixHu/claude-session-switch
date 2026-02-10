import { useState, useCallback } from "react";

export interface LayoutState {
  sidebarWidth: number;
  mainWidth: number;
  terminalHeight: number;
}

const DEFAULT_LAYOUT: LayoutState = {
  sidebarWidth: 300,
  mainWidth: 500,
  terminalHeight: 300,
};

function clampSidebarWidth(width: number): number {
  const minWidth = 200;
  const hardMaxWidth = 600;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
  const minMainWidth = 420;
  const viewportMaxWidth = Math.max(minWidth, viewportWidth - minMainWidth);
  const maxWidth = Math.min(hardMaxWidth, viewportMaxWidth);
  return Math.max(minWidth, Math.min(width, maxWidth));
}

function clampMainWidth(width: number): number {
  const minWidth = 300;
  const maxWidth = 1000;
  return Math.max(minWidth, Math.min(width, maxWidth));
}

function clampTerminalHeight(height: number): number {
  const minHeight = 100;
  const maxHeight = 800;
  return Math.max(minHeight, Math.min(height, maxHeight));
}

function normalizeLayout(layout: LayoutState): LayoutState {
  return {
    sidebarWidth: clampSidebarWidth(layout.sidebarWidth),
    mainWidth: clampMainWidth(layout.mainWidth),
    terminalHeight: clampTerminalHeight(layout.terminalHeight),
  };
}

export function useWindowManager() {
  const [layout, setLayout] = useState<LayoutState>(DEFAULT_LAYOUT);

  const setLayoutState = useCallback((nextLayout: LayoutState) => {
    const normalizedNext = normalizeLayout(nextLayout);

    setLayout((previous) => {
      if (
        previous.sidebarWidth === normalizedNext.sidebarWidth &&
        previous.mainWidth === normalizedNext.mainWidth &&
        previous.terminalHeight === normalizedNext.terminalHeight
      ) {
        return previous;
      }

      return normalizedNext;
    });
  }, []);

  const updateSidebarWidth = useCallback((width: number) => {
    setLayout((previous) => {
      const nextSidebarWidth = clampSidebarWidth(width);
      if (nextSidebarWidth === previous.sidebarWidth) {
        return previous;
      }

      return {
        ...previous,
        sidebarWidth: nextSidebarWidth,
      };
    });
  }, []);

  const updateMainWidth = useCallback((width: number) => {
    setLayout((previous) => {
      const nextMainWidth = clampMainWidth(width);
      if (nextMainWidth === previous.mainWidth) {
        return previous;
      }

      return {
        ...previous,
        mainWidth: nextMainWidth,
      };
    });
  }, []);

  const updateTerminalHeight = useCallback((height: number) => {
    setLayout((previous) => {
      const nextTerminalHeight = clampTerminalHeight(height);
      if (nextTerminalHeight === previous.terminalHeight) {
        return previous;
      }

      return {
        ...previous,
        terminalHeight: nextTerminalHeight,
      };
    });
  }, []);

  const resetLayout = useCallback(() => {
    setLayout((previous) => {
      if (
        previous.sidebarWidth === DEFAULT_LAYOUT.sidebarWidth &&
        previous.mainWidth === DEFAULT_LAYOUT.mainWidth &&
        previous.terminalHeight === DEFAULT_LAYOUT.terminalHeight
      ) {
        return previous;
      }

      return DEFAULT_LAYOUT;
    });
  }, []);

  return {
    layout,
    setLayoutState,
    updateSidebarWidth,
    updateMainWidth,
    updateTerminalHeight,
    resetLayout,
  };
}
