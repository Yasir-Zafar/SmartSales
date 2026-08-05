import axios from 'axios';
import qs from 'qs';

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * The one HTTP client the app uses.
 *
 * `withCredentials` is what makes the httpOnly session cookies travel. The
 * frontend never sees, stores or forwards a token — it only proves same-origin
 * intent by echoing the CSRF cookie in a header.
 */
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 60_000,
  // Repeat-style arrays (?category=a&category=b) are what the backend parses.
  paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat', skipNulls: true }),
});

const CSRF_COOKIE = 'ss_csrf';

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = readCookie(CSRF_COOKIE);
    if (token) config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

// ── Silent refresh ───────────────────────────────────────────────────────────
/**
 * When the 15-minute access token expires mid-session the user should never
 * notice. The first 401 triggers one refresh; every other request that fails
 * during that window queues behind the same promise instead of stampeding the
 * refresh endpoint.
 */
let refreshPromise = null;
const sessionEndedListeners = new Set();

/**
 * Whether this page ever held a session.
 *
 * Without this, a first-ever visitor's 401 on /auth/me is indistinguishable
 * from a session being revoked mid-use, and they get told "your session
 * expired" before they have ever signed in.
 */
let sessionEstablished = false;

export function markSessionEstablished() {
  sessionEstablished = true;
}

export function clearSessionEstablished() {
  sessionEstablished = false;
}

/** Subscribe to "the session is definitively over" so the app can redirect once. */
export function onSessionEnded(listener) {
  sessionEndedListeners.add(listener);
  return () => sessionEndedListeners.delete(listener);
}

function announceSessionEnded(reason) {
  // Nothing to announce if the visitor never had a session to lose.
  if (!sessionEstablished) return;
  sessionEstablished = false;

  sessionEndedListeners.forEach((listener) => {
    try {
      listener(reason);
    } catch (err) {
      console.error('session listener failed', err);
    }
  });
}

export async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh')
      .then((res) => {
        markSessionEstablished();
        return res.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

const NO_RETRY_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    if (!response || !config) return Promise.reject(error);

    const url = config.url || '';
    const isAuthPath = NO_RETRY_PATHS.some((p) => url.includes(p));
    const code = response.data?.code;

    // Only an expired access token is retryable. A revoked, stale or reused
    // token means the session is genuinely over.
    const retryable = response.status === 401 && code === 'TOKEN_EXPIRED';

    if (retryable && !isAuthPath && !config.__retried) {
      config.__retried = true;
      try {
        await refreshSession();
        return api(config);
      } catch (refreshError) {
        announceSessionEnded(refreshError?.response?.data?.code || 'REFRESH_FAILED');
        return Promise.reject(refreshError);
      }
    }

    if (response.status === 401 && !isAuthPath) {
      announceSessionEnded(code || 'UNAUTHORIZED');
    }

    return Promise.reject(error);
  }
);

/** Turns any axios failure into a sentence worth showing a person. */
export function errorMessage(error, fallback = 'Something went wrong') {
  if (!error) return fallback;

  if (error.code === 'ECONNABORTED') return 'The request timed out. The service may be busy — try again.';
  if (!error.response) return 'Could not reach the server. Check that the API is running.';

  const data = error.response.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data?.message) return data.message;

  const byStatus = {
    400: 'That request was not valid.',
    403: 'You do not have access to this.',
    404: 'Nothing was found for that request.',
    413: 'That file is too large.',
    429: 'Too many requests — wait a moment and try again.',
    500: 'The server hit an error.',
    503: 'A dependent service is unavailable right now.',
  };
  return byStatus[error.response.status] || fallback;
}

/**
 * True when a failure is the ML microservice being down rather than a bug.
 * Lets pages show "start the ML service" instead of a generic red banner.
 */
export function isMlUnavailable(error) {
  const msg = String(error?.response?.data?.message || error?.message || '').toLowerCase();
  return (
    error?.response?.status === 503 ||
    msg.includes('econnrefused') ||
    msg.includes('fetch failed') ||
    msg.includes('no data loaded') ||
    msg.includes('ml request failed')
  );
}

export default api;
