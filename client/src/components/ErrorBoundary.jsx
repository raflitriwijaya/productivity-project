// client/src/components/ErrorBoundary.jsx
// Phase 2: class-based error boundary (React 19 still requires class components
// for componentDidCatch / getDerivedStateFromError).
// Wraps <App /> in main.jsx to prevent a render-time throw from white-screening the SPA.
import { Component } from 'react';
import { ErrorState } from './ui/ErrorState';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(err, info) {
    console.error('[ErrorBoundary] Uncaught render error:', err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <ErrorState
            message={this.state.message}
            onRetry={() => window.location.reload()}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
