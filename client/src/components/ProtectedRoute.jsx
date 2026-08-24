import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EmptyState, LoadingState } from './States';
import Button from './Button';

/**
 * Route guard. Redirects unauthenticated visitors to sign-in and shows a clear
 * "not authorised" screen when a signed-in user lacks the permission - the API
 * would reject the underlying calls regardless.
 */
export default function ProtectedRoute({ permission, children }) {
  const { isAuthenticated, bootstrapping, can } = useAuth();
  const location = useLocation();

  if (bootstrapping) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <LoadingState label="Restoring your session…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (permission && !can(...[].concat(permission))) {
    return (
      <div className="page">
        <div className="card">
          <EmptyState
            icon="lock"
            title="You do not have access to this area"
            text="Your role does not include the permission required for this page. Contact an administrator if you believe this is a mistake."
            action={<Button to="/dashboard" variant="secondary">Back to dashboard</Button>}
          />
        </div>
      </div>
    );
  }

  return children;
}
