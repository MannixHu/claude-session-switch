# API State Management

This directory contains context and utilities for centralized API state management across the application.

## ApiStateContext

The `ApiStateContext` provides a way to share loading and error states from `useBackend` hook throughout the component tree without prop drilling.

### Usage

#### 1. Wrap your app with ApiStateProvider

```tsx
// src/App.tsx
import { ApiStateProvider } from "./context/ApiStateContext";
import { useBackend } from "./hooks/useBackend";

export function App() {
  const { loading, error, clearError } = useBackend();

  return (
    <ApiStateProvider loading={loading} error={error} clearError={clearError}>
      <YourApp />
    </ApiStateProvider>
  );
}
```

#### 2. Access state in any child component

```tsx
// src/components/MyComponent.tsx
import { useApiState } from "../context/ApiStateContext";
import { ErrorAlert } from "./ErrorAlert";
import { LoadingSpinner } from "./LoadingSpinner";

export function MyComponent() {
  const { loading, error, clearError } = useApiState();

  return (
    <>
      {loading && <LoadingSpinner text="Loading data..." />}
      {error && <ErrorAlert message={error} onDismiss={clearError} />}
      {/* Your content here */}
    </>
  );
}
```

## Reusable Components

### LoadingSpinner

Displays a loading indicator with optional text.

**Props:**
- `text?: string` - Loading message (default: "Loading...")
- `fullscreen?: boolean` - Show as fullscreen overlay (default: false)

**Example:**
```tsx
<LoadingSpinner text="Fetching data..." />
<LoadingSpinner fullscreen />
```

### ErrorAlert

Displays error messages with optional dismiss button.

**Props:**
- `message: string | null` - Error message to display
- `onDismiss?: () => void` - Callback when dismiss button clicked
- `variant?: 'inline' | 'banner'` - Display style (default: "inline")

**Example:**
```tsx
<ErrorAlert
  message={error}
  onDismiss={clearError}
  variant="banner"
/>
```

## Benefits

1. **No Prop Drilling**: Avoid passing loading/error states through multiple component levels
2. **Consistency**: All components use the same loading/error UI patterns
3. **Simplicity**: Components focus on their data, not state management plumbing
4. **Reusability**: Common UI patterns are isolated in dedicated components

## Migration Guide

### Before
```tsx
function ProjectList() {
  const { listProjects, loading, error } = useBackend();

  return (
    <div>
      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">{error}</div>}
      {/* List content */}
    </div>
  );
}
```

### After
```tsx
function ProjectList() {
  const { listProjects } = useBackend();
  const { loading, error, clearError } = useApiState();

  return (
    <div>
      <LoadingSpinner text="Loading projects..." />
      <ErrorAlert message={error} onDismiss={clearError} />
      {/* List content */}
    </div>
  );
}
```

## Future Enhancements

Consider these improvements in the future:

1. **React Query/SWR Integration**: For advanced caching and deduplication
2. **Operation-Specific State**: Track which operation is loading (not just global state)
3. **Toast Notifications**: Replace error alerts with dismissible toasts
4. **Retry Mechanism**: Built-in retry button for failed operations
