import { BackendProvider, useBackend } from "./hooks/useBackend";
import { ApiStateProvider } from "./context/ApiStateContext";
import { ProjectDashboard } from "./pages/ProjectDashboard";
import "./App.css";

/**
 * Main App component that sets up the API state context
 * This allows all child components to access global loading/error state
 */
function AppWithContext() {
  const { loading, error, clearError } = useBackend();

  return (
    <ApiStateProvider loading={loading} error={error} clearError={clearError}>
      <ProjectDashboard />
    </ApiStateProvider>
  );
}

export default function App() {
  return (
    <BackendProvider>
      <AppWithContext />
    </BackendProvider>
  );
}
