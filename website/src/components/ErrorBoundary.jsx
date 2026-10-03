import React, { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: this.props.inline ? '240px' : '60vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              width: '100%',
              background: '#ffffff',
              border: '1px solid #fee2e2',
              borderRadius: '16px',
              padding: '28px 24px',
              boxShadow: '0 10px 25px -5px rgba(220, 38, 38, 0.08)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.6rem',
                margin: '0 auto 16px auto',
              }}
            >
              ⚠️
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
              Something went wrong
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#0b5394', fontWeight: 700, margin: '0 0 10px 0' }}>
              ఏదో పొరపాటు జరిగింది
            </p>
            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              {this.props.message ||
                "An unexpected display issue occurred in this section. Your business data is safe."}
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReset}
                className="btn btn-primary"
                style={{
                  background: '#0b5394',
                  padding: '9px 18px',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  borderRadius: '8px',
                }}
              >
                🔄 Try Again / మళ్లీ ప్రయత్నించండి
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = '/')}
                className="btn btn-secondary"
                style={{
                  padding: '9px 18px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                }}
              >
                🏠 Dashboard
              </button>
            </div>

            {this.state.error && (
              <details
                style={{
                  marginTop: '20px',
                  textAlign: 'left',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '0.78rem',
                  color: '#475569',
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#64748b' }}>
                  Technical Details (Debug)
                </summary>
                <pre
                  style={{
                    marginTop: '8px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    color: '#dc2626',
                    fontFamily: 'monospace',
                    fontSize: '0.72rem',
                    maxHeight: '160px',
                    overflowY: 'auto',
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
