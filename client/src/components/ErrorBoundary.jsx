import { Component } from 'react';
import Icon from './Icon';

/**
 * Last line of defence: a render error shows a recoverable screen rather than a
 * blank page. Details are logged to the console, never shown to the customer.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[nexbank] render error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 460, width: '100%' }}>
          <div className="state">
            <div className="state__icon state__icon--danger">
              <Icon name="alert" size={22} />
            </div>
            <p className="state__title">Something went wrong</p>
            <p className="state__text">
              NexBank could not display this screen. Reloading usually resolves it. Your accounts and balances are
              unaffected.
            </p>
            <div className="state__actions">
              <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
                Reload NexBank
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
