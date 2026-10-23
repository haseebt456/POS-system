import { HashRouter, matchPath, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginScreen from './components/auth/LoginScreen';
import AppShell from './components/layout/AppShell';
import Fallback from './components/screens/Fallback';
import { homeFor, leaves, OPERATOR } from './routes';
import styles from './App.module.css';

// A path that exists for some role but not this one still lands here, so the message is
// decided by looking the path up rather than by assuming.
function Unknown({ role }) {
  const location = useLocation();
  const home = homeFor(role);

  const exists = leaves().some((leaf) =>
    matchPath({ path: leaf.path, end: true }, location.pathname)
  );

  if (exists) {
    return (
      <Fallback
        title="Not available to your account"
        homePath={home}
        homeLabel={role === OPERATOR ? 'Back to the till' : 'Back to the dashboard'}
      >
        This screen is part of the manager side of the system. Ask an admin if you need
        access to it.
      </Fallback>
    );
  }

  return (
    <Fallback
      title="Page not found"
      homePath={home}
      homeLabel={role === OPERATOR ? 'Back to the till' : 'Back to the dashboard'}
    >
      There is nothing at <code>{location.pathname}</code>.
    </Fallback>
  );
}

// The whole routing decision, in one place: what a signed-out visitor sees, and what a
// signed-in one can reach.
function Root() {
  const { user, status } = useAuth();

  if (status === 'loading') {
    return <div className={styles.boot}>Starting…</div>;
  }

  if (status === 'signedOut') {
    // A wildcard rather than a /login route, on purpose: whatever URL the app was opened
    // at stays in the address bar while the login screen is up, so there is no route a
    // signed-out visitor can reach — and the login screen gets to decide whether that URL
    // is worth honouring once it knows who just signed in.
    return (
      <Routes>
        <Route path="*" element={<LoginScreen />} />
      </Routes>
    );
  }

  // Only the current role's routes are registered at all. An operator's router has no
  // /settings/printers entry, which is why that path falls through to Unknown — and why
  // the nav and the router cannot disagree about what exists.
  const allowed = leaves().filter((leaf) => leaf.roles.includes(user.role));

  return (
    <Routes>
      <Route element={<AppShell />}>
        {allowed.map((leaf) => (
          <Route key={leaf.id} path={leaf.path} element={leaf.element} />
        ))}
        <Route path="*" element={<Unknown role={user.role} />} />
      </Route>
    </Routes>
  );
}

// HashRouter, not BrowserRouter: the frontend is loaded from file:// inside Electron in a
// packaged build, where path-based routing has no server to fall back to /index.html.
function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Root />
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
