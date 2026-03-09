import React, { createContext, ReactNode } from "react";

/**
 * API State Context
 * Provides a centralized way to access loading and error states from useBackend
 * without having to pass them through multiple component levels
 */

export interface ApiStateContextType {
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

export const ApiStateContext = createContext<ApiStateContextType | undefined>(undefined);

interface ApiStateProviderProps {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  children: ReactNode;
}

/**
 * Provider component that wraps the app and supplies API state context
 */
export function ApiStateProvider({
  loading,
  error,
  clearError,
  children,
}: ApiStateProviderProps) {
  const value: ApiStateContextType = {
    loading,
    error,
    clearError,
  };

  return (
    <ApiStateContext.Provider value={value}>{children}</ApiStateContext.Provider>
  );
}

/**
 * Hook to access API state context
 * Must be used within ApiStateProvider
 */
export function useApiState(): ApiStateContextType {
  const context = React.useContext(ApiStateContext);
  if (!context) {
    throw new Error("useApiState must be used within ApiStateProvider");
  }
  return context;
}
