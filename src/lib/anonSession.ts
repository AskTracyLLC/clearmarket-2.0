/**
 * Provides a stable anonymous session ID for rate limiting unauthenticated users.
 * Persists in localStorage so it survives page reloads but is unique per device/browser.
 */

const STORAGE_KEY = "clearmarket_anon_session_id";

export function getAnonSessionId(): string {
  if (typeof window === "undefined" || !window.localStorage) {
    // SSR or no localStorage - return a transient ID
    return crypto.randomUUID();
  }

  let id = localStorage.getItem(STORAGE_KEY);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }

  return id;
}
