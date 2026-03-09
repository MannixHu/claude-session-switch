import "./LoadingSpinner.css";

interface LoadingSpinnerProps {
  text?: string;
  fullscreen?: boolean;
}

/**
 * Reusable loading spinner component
 * Can be shown inline or fullscreen
 */
export function LoadingSpinner({
  text = "Loading...",
  fullscreen = false,
}: LoadingSpinnerProps) {
  return (
    <div className={`loading-spinner ${fullscreen ? "fullscreen" : ""}`}>
      <div className="spinner"></div>
      <p>{text}</p>
    </div>
  );
}
