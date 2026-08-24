/**
 * Single entry point for every API call.
 *
 * Unwraps the server's response envelope, turns failures into a typed ApiError
 * carrying the machine code and any field-level details, and clears the session
 * when the server reports the token is no longer valid.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'nexbank.token';

export class ApiError extends Error {
  constructor(message, { code = 'UNKNOWN', status = 0, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage may be unavailable in private mode */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

/** Called when the server rejects the session, so the app can route to sign-in. */
let onSessionExpired = () => {};
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

function buildQuery(params) {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.append(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function request(method, path, { body, params, signal } = {}) {
  const token = tokenStore.get();

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}${buildQuery(params)}`, {
      method,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(
      'We could not reach NexBank. Check your connection and try again.',
      { code: 'NETWORK_ERROR' },
    );
  }

  if (response.status === 204) return null;

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('We received an unexpected response from the server.', {
      code: 'INVALID_RESPONSE',
      status: response.status,
    });
  }

  if (!response.ok || payload.success === false) {
    const error = payload.error || {};

    if (response.status === 401) {
      tokenStore.clear();
      onSessionExpired(error.code === 'SESSION_EXPIRED');
    }

    throw new ApiError(error.message || 'Something went wrong. Please try again.', {
      code: error.code || 'REQUEST_FAILED',
      status: response.status,
      details: error.details || null,
    });
  }

  return payload.data;
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  delete: (path, options) => request('DELETE', path, options),
};

export default api;
