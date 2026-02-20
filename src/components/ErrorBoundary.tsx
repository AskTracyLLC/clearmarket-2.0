import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground p-8">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground text-sm max-w-md text-center">
            An unexpected error occurred. Please reload the page to continue.
          </p>
          {this.state.error && (
            <pre className="text-xs text-muted-foreground bg-muted rounded p-3 max-w-lg overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
