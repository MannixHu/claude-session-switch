import { useCallback } from "react";
import "./ErrorAlert.css";

interface ErrorAlertProps {
  message: string | null;
  onDismiss?: () => void;
  variant?: "inline" | "banner";
}

/**
 * Reusable error alert component
 * Displays error messages with dismiss option
 */
export function ErrorAlert({
  message,
  onDismiss,
  variant = "inline",
}: ErrorAlertProps) {
  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  if (!message) {
    return null;
  }

  return (
    <div className={`error-alert error-alert-${variant}`}>
      <div className="error-content">
        <span className="error-icon">⚠</span>
        <span className="error-message">{message}</span>
      </div>
      {onDismiss && (
        <button
          className="error-dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss error"
        >
          ×
        </button>
      )}
    </div>
  );
}
