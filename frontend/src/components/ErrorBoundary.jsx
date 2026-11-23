import { Component } from 'react';

/**
 * Error boundary (#35).
 *
 * Prevents a component crash from leaving users with a blank page. The
 * fallback renders an accessible retry / return-home experience and never
 * exposes exception details. In production it logs a redacted diagnostic
 * (error name only — never message or stack, which may contain sensitive
 * data). In development the full error and component stack are logged.
 */

export default class ErrorBoundary extends Component {
  state = { error: null, errorInfo: null, retryKey: 0 };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    const diagnostic = {
      name: error && error.name ? error.name : 'UnknownError',
      // Redacted by design: error.message and stack can leak sensitive data.
      message: import.meta.env.PROD ? 'redacted' : error && error.message ? error.message : '',
    };
    if (import.meta.env.PROD) {
      console.error('[ErrorBoundary] production fault (redacted)', diagnostic);
    } else {
      console.error('[ErrorBoundary]', error, errorInfo.componentStack, diagnostic);
    }
  }

  handleRetry = () => {
    this.setState(prev => ({ error: null, errorInfo: null, retryKey: prev.retryKey + 1 }));
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    const { error } = this.state;

    if (error) {
      return (
        <div
          role="alert"
          aria-live="polite"
          style={{
            maxWidth: 500,
            margin: '4rem auto',
            padding: '2rem',
            textAlign: 'center',
            color: '#e2e8f0',
          }}
        >
          <h2 style={{ color: '#f87171', marginBottom: '0.75rem' }}>Something went wrong</h2>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
            We encountered an unexpected issue and cannot display this page.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.6rem 1.5rem',
                background: '#0ea5e9',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <button
              onClick={this.handleHome}
              style={{
                padding: '0.6rem 1.5rem',
                background: '#334155',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Return home
            </button>
          </div>
        </div>
      );
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}
