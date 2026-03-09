import { useEffect, useState } from "react";
import { useBackend, Project } from "../hooks/useBackend";
import { useApiState } from "../context/ApiStateContext";
import { LoadingSpinner } from "./LoadingSpinner";
import { ErrorAlert } from "./ErrorAlert";

/**
 * Example component showing how to use the ApiStateContext
 *
 * This demonstrates the pattern for:
 * - Using useBackend to call API methods
 * - Using useApiState to access global loading/error states
 * - Using LoadingSpinner and ErrorAlert reusable components
 *
 * Benefits:
 * - No prop drilling of loading/error through component tree
 * - Consistent UI patterns across all components
 * - Simple, declarative error/loading handling
 */
export function ExampleWithApiState() {
  // Get API methods from useBackend
  const { listProjects } = useBackend();

  // Get global loading/error state from context
  const { loading, error, clearError } = useApiState();

  // Local component state for data
  const [projects, setProjects] = useState<Project[]>([]);

  // Load projects when component mounts
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await listProjects();
        setProjects(data);
      } catch (err) {
        // Error is automatically captured by useBackend and available via useApiState
        console.error("Failed to load projects", err);
      }
    };
    loadData();
  }, [listProjects]);

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Projects</h2>

      {/* Loading state - automatically handled by global context */}
      {loading && <LoadingSpinner text="Loading projects..." />}

      {/* Error state - dismissible with global clearError function */}
      {error && (
        <ErrorAlert
          message={error}
          onDismiss={clearError}
          variant="banner"
        />
      )}

      {/* Data display */}
      {!loading && projects.length > 0 && (
        <div>
          {projects.map((project) => (
            <div key={project.id} style={{ padding: "0.5rem", border: "1px solid #ccc" }}>
              <strong>{project.name}</strong>
              <p>{project.path}</p>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && projects.length === 0 && !error && (
        <p style={{ color: "#999" }}>No projects found</p>
      )}
    </div>
  );
}

/**
 * MIGRATION CHECKLIST
 *
 * To use this pattern in your existing components:
 *
 * 1. Import the hooks:
 *    import { useBackend } from "../hooks/useBackend";
 *    import { useApiState } from "../context/ApiStateContext";
 *    import { LoadingSpinner } from "./LoadingSpinner";
 *    import { ErrorAlert } from "./ErrorAlert";
 *
 * 2. Replace direct loading/error state:
 *    // OLD
 *    const { listProjects, loading, error } = useBackend();
 *
 *    // NEW
 *    const { listProjects } = useBackend();
 *    const { loading, error, clearError } = useApiState();
 *
 * 3. Replace inline loading/error UI:
 *    // OLD
 *    {loading && <div className="loading">Loading...</div>}
 *    {error && <div className="error">{error}</div>}
 *
 *    // NEW
 *    {loading && <LoadingSpinner text="Loading data..." />}
 *    {error && <ErrorAlert message={error} onDismiss={clearError} />}
 *
 * 4. Build and test
 *    npm run build:ui
 */
