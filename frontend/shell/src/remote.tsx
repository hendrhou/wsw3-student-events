import { Component, Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { Button, Skeleton } from "@campus-pulse/ui";

function RemoteFallback() {
  return (
    <div className="cp-page" aria-busy="true" aria-label="Loading module">
      <Skeleton height={40} />
      <Skeleton height={240} />
      <Skeleton height={240} />
    </div>
  );
}

interface BoundaryState {
  failed: boolean;
}

/**
 * A failed remote (unreachable MFE, stale remoteEntry) must never blank the
 * whole shell — the boundary confines the failure to the screen area.
 */
class RemoteBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("remote module failed to load", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="cp-page" role="alert">
          <p>This module is unavailable right now.</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Bind a named export of a federated remote ("<name>/components") as a lazy
 * screen component with loading skeleton and error boundary.
 */
export function remote<P extends object>(load: () => Promise<ComponentType<P>>): ComponentType<P> {
  const Inner = lazy(async () => ({ default: await load() }));
  return function RemoteScreen(props: P) {
    return (
      <RemoteBoundary>
        <Suspense fallback={<RemoteFallback />}>
          <Inner {...props} />
        </Suspense>
      </RemoteBoundary>
    );
  };
}
