import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, getToken, setToken, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

// Who is signed in, and how we got here.
//
// `status` is three-valued rather than a boolean, and that is the point: on first paint we
// do not yet know whether the stored token is still good, and rendering the login screen
// during that moment would flash it in front of someone who is already signed in. 'loading'
// is a real state with its own UI.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'signedOut' | 'signedIn'

  // Restore a session on load, so a refresh — or the Electron window reopening — does not
  // mean signing in again.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!getToken()) {
        setStatus('signedOut');
        return;
      }
      try {
        const me = await authApi.me();
        if (cancelled) return;
        setUser(me);
        setStatus('signedIn');
      } catch {
        // Expired, revoked from Settings, or the account was deactivated. Either way the
        // token is worthless now and holding onto it would just fail again on every call.
        if (cancelled) return;
        setToken(null);
        setUser(null);
        setStatus('signedOut');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // The client tells us when the server rejects a token mid-session — see api/client.js.
  // Without this, a session that expires while someone is on the POS screen turns every
  // subsequent click into a red error with no indication that signing in is the fix.
  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
      setStatus('signedOut');
    }
    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, []);

  const signIn = useCallback(async ({ token, user: signedIn }) => {
    setToken(token);
    setUser(signedIn);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    // Best effort. If the server is unreachable the token is dropped locally anyway —
    // refusing to sign someone out because the network is down would be perverse.
    try {
      await authApi.logout();
    } catch {
      /* the session is being discarded regardless */
    }
    setToken(null);
    setUser(null);
    setStatus('signedOut');
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, status, isAdmin: user?.role === 'admin', signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
