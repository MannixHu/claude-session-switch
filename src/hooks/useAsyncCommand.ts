import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * Configuration for async command execution
 */
export interface AsyncCommandConfig {
  /** Whether to track loading state (default: true) */
  trackLoading?: boolean;
}

/**
 * Hook for managing async command execution with loading/error state
 * Provides methods to create wrapped async commands with built-in state management
 */
export function useAsyncCommand(
  setLoading: (loading: boolean) => void,
  clearError: () => void,
  setError: (error: string | null) => void,
  normalizeError: (error: unknown) => string
) {
  /**
   * Generic command wrapper that handles invoke calls with state management
   */
  const createCommand = useCallback(
    <T,>(
      command: string,
      buildParams: () => Record<string, unknown>,
      config: AsyncCommandConfig = {}
    ): (() => Promise<T>) => {
      const { trackLoading = true } = config;
      return async () => {
        if (trackLoading) setLoading(true);
        clearError();
        try {
          return await invoke<T>(command, buildParams());
        } catch (error) {
          setError(normalizeError(error));
          throw error;
        } finally {
          if (trackLoading) setLoading(false);
        }
      };
    },
    [setLoading, clearError, setError, normalizeError]
  );

  /**
   * Wrapper for commands that take a single parameter
   */
  const createCommandWithParam = useCallback(
    <P, T>(
      command: string,
      buildParams: (param: P) => Record<string, unknown> | Promise<Record<string, unknown>>,
      config: AsyncCommandConfig = {}
    ): ((param: P) => Promise<T>) => {
      const { trackLoading = true } = config;
      return async (param: P) => {
        if (trackLoading) setLoading(true);
        clearError();
        try {
          const params = await Promise.resolve(buildParams(param));
          return await invoke<T>(command, params);
        } catch (error) {
          setError(normalizeError(error));
          throw error;
        } finally {
          if (trackLoading) setLoading(false);
        }
      };
    },
    [setLoading, clearError, setError, normalizeError]
  );

  /**
   * Wrapper for commands that take multiple parameters
   */
  const createCommandWithParams = useCallback(
    <P extends unknown[], T>(
      command: string,
      buildParams: (...args: P) => Record<string, unknown> | Promise<Record<string, unknown>>,
      config: AsyncCommandConfig = {}
    ): ((...args: P) => Promise<T>) => {
      const { trackLoading = true } = config;
      return async (...args: P) => {
        if (trackLoading) setLoading(true);
        clearError();
        try {
          const params = await Promise.resolve(buildParams(...args));
          return await invoke<T>(command, params);
        } catch (error) {
          setError(normalizeError(error));
          throw error;
        } finally {
          if (trackLoading) setLoading(false);
        }
      };
    },
    [setLoading, clearError, setError, normalizeError]
  );

  /**
   * Wrapper for custom async operations
   */
  const createAsyncOperation = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      config: AsyncCommandConfig = {}
    ): Promise<T> => {
      const { trackLoading = true } = config;
      if (trackLoading) setLoading(true);
      clearError();
      try {
        return await operation();
      } catch (error) {
        setError(normalizeError(error));
        throw error;
      } finally {
        if (trackLoading) setLoading(false);
      }
    },
    [setLoading, clearError, setError, normalizeError]
  );

  return {
    createCommand,
    createCommandWithParam,
    createCommandWithParams,
    createAsyncOperation,
  };
}
