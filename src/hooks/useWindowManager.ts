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

const STORAGE_KEY = "cloudcode_layout_state";

export function useWindowManager() {
  const [layout, setLayout] = useState<LayoutState>(() => {
    // Try to load from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load layout state from localStorage", e);
    }
    return DEFAULT_LAYOUT;
  });

  const saveLayout = useCallback((newLayout: LayoutState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout));
      setLayout(newLayout);
    } catch (e) {
      console.warn("Failed to save layout state to localStorage", e);
      setLayout(newLayout);
    }
  }, []);

  const updateSidebarWidth = useCallback(
    (width: number) => {
      const minWidth = 200;
      const maxWidth = 600;
      const constrainedWidth = Math.max(minWidth, Math.min(width, maxWidth));
      saveLayout({ ...layout, sidebarWidth: constrainedWidth });
    },
    [layout, saveLayout]
  );

  const updateMainWidth = useCallback(
    (width: number) => {
      const minWidth = 300;
      const maxWidth = 1000;
      const constrainedWidth = Math.max(minWidth, Math.min(width, maxWidth));
      saveLayout({ ...layout, mainWidth: constrainedWidth });
    },
    [layout, saveLayout]
  );

  const updateTerminalHeight = useCallback(
    (height: number) => {
      const minHeight = 100;
      const maxHeight = 800;
      const constrainedHeight = Math.max(minHeight, Math.min(height, maxHeight));
      saveLayout({ ...layout, terminalHeight: constrainedHeight });
    },
    [layout, saveLayout]
  );

  const resetLayout = useCallback(() => {
    saveLayout(DEFAULT_LAYOUT);
  }, [saveLayout]);

  return {
    layout,
    updateSidebarWidth,
    updateMainWidth,
    updateTerminalHeight,
    resetLayout,
  };
}
