import { Component } from 'react';

/**
 * Redacts an error message for production so stack frames and internal paths
 * are never sent to the browser.  Only the first sentence of a safe, generic
 * description is kept.
 */
function redact(message) {
  if (!message) return 'An unexpected error occurred.';
  // Strip anything after a newline (stack trace), file paths, and long tokens.
  const firstLine = message.split('\n')[0].trim();
  // If the first line looks like it contains a path or stack frame, redact it.
  if (/at |\/|\\\\|TypeError:|ReferenceError:|SyntaxError:/.test(firstLine)) {
    return 'An unexpected error occurred.';
  }
  // Cap length to prevent accidentally leaking long encoded data.
  return firstLine.length > 120 ? 'An unexpected error occurred.' : firstLine;
}

/**
 * Logs a diagnostic to the console in development or to a production-safe
 * sink (window.onerror / a monitoring agent) in production.
 *
 * The production path logs only the redacted message and a component display
 * name, never the full stack.
 */
function logError(error, info, isDev) {
  if (isDev) {
    // Full detail in development so engineers can debug quickly.
    console.error('[ErrorBoundary]', error, info?.componentStack);
    return;
  }

  // Production: surface only what is safe to log.
  const safeMessage = redact(error?.message);
  const componentName = info?.componentStack
    ? info.componentStack.split('\n')[1]?.trim().replace(/^at /, '') || 'unknown'
    : 'unknown';

  // Use console.warn so the entry appears in browser devtools without exposing
  // a full stack.  Replace this call with your monitoring SDK (e.g. Sentry,
  // Datadog) when available.
  console.warn('[ErrorBoundary] Component error', { component: componentName, message: safeMessage });
}

export default class ErrorBoundary extends Component {
  state = { hasError: false, safeMessage: null };

  static getDerivedStateFromError(error) {
    const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
    return {
      hasError: true,
      // Store only the redacted message in state; never the raw Error object.
      safeMessage: isDev ? (error?.message || 'An unexpected error occurred.') : redact(error?.message),
    };
  }

  componentDidCatch(error, info) {
    const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
    logError(error, info, isDev);
  }

  handleReset = () => {
    this.setState({ hasError: false, safeMessage: null });
  };

  render() {
    if (this.state.hasError) {
      // Allow the consumer to supply a custom fallback UI.
      if (this.props.fallback) {
        return this.props.fallback({
          message: this.state.safeMessage,
          onReset: this.handleReset,
        });
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            maxWidth: 500,
            margin: '4rem auto',
            padding: '2rem',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h2 style={{ color: '#f87171', marginBottom: '0.75rem' }}>Something went wrong</h2>
          {/* Safe message only — never raw exception details */}
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
            {this.state.safeMessage}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              style={{
                padding: '0.6rem 1.5rem',
                background: '#0ea5e9',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: '1rem',
              }}
              onClick={this.handleReset}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: '0.6rem 1.5rem',
                background: 'transparent',
                color: '#0ea5e9',
                border: '1px solid #0ea5e9',
                borderRadius: 8,
                fontSize: '1rem',
                textDecoration: 'none',
                display: 'inline-block',
                lineHeight: 'normal',
              }}
            >
              Return home
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
