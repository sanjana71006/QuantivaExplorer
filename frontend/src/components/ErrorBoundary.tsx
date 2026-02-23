import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: Error };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError(_: any) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log the error for diagnostics
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught error:", error, info);
    this.setState({ error });
  }

  handleRetry() {
    this.setState({ hasError: false, error: undefined });
  }

  render() {
    if (this.state.hasError) {
      const stack = (this.state.error && (this.state.error as any).stack) || "";
      return (
        <div className="glass-card p-4">
          <p className="font-semibold">Rendering error in 3D view</p>
          <p className="text-sm text-muted-foreground">{this.state.error?.message}</p>
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer">Show details</summary>
            <pre className="whitespace-pre-wrap text-[11px] mt-2">{stack}</pre>
          </details>
          <div className="mt-3 flex gap-2">
            <button onClick={this.handleRetry} className="px-3 py-1 bg-primary text-primary-foreground rounded">Retry</button>
            <button onClick={() => { navigator.clipboard?.writeText(`${this.state.error?.message}\n\n${stack}`); }} className="px-3 py-1 border rounded">Copy</button>
            <a className="px-3 py-1 bg-emerald-600 text-white rounded" href={`mailto:devteam@example.com?subject=App%20Error&body=${encodeURIComponent(this.state.error?.message + "\n\n" + stack)}`} rel="noreferrer">Report</a>
          </div>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
