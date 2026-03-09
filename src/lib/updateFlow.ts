import type { UpdateCheckResult } from "../hooks/useBackend.ts";

export type UpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "up_to_date"
  | "completed"
  | "error";

export type UpdateState = {
  phase: UpdatePhase;
  error: string;
  metadata: UpdateCheckResult | null;
};

export function createIdleUpdateState(): UpdateState {
  return {
    phase: "idle",
    error: "",
    metadata: null,
  };
}

export function beginUpdateCheck(state: UpdateState): UpdateState {
  if (state.phase === "checking" || state.phase === "downloading") {
    return state;
  }

  return {
    phase: "checking",
    error: "",
    metadata: null,
  };
}

export function applyUpdateCheckResult(
  _state: UpdateState,
  result: UpdateCheckResult
): UpdateState {
  if (!result.update_available) {
    return {
      phase: "up_to_date",
      error: "",
      metadata: null,
    };
  }

  return {
    phase: "available",
    error: "",
    metadata: result,
  };
}

export function beginUpdateDownload(state: UpdateState): UpdateState {
  if (!state.metadata) {
    return state;
  }

  return {
    ...state,
    phase: "downloading",
    error: "",
  };
}

export function applyUpdateSuccess(state: UpdateState): UpdateState {
  return {
    ...state,
    phase: "completed",
    error: "",
  };
}

export function applyUpdateError(state: UpdateState, error: string): UpdateState {
  return {
    ...state,
    phase: "error",
    error: error.trim(),
  };
}
