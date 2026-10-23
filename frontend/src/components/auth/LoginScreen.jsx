import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { BUSINESS_NAME } from '../../lib/business';
import { homeFor, isAllowed } from '../../routes';
import { Banner, Button, Field, Icon, Input } from '../ui';
import styles from './LoginScreen.module.css';

const PIN_MAX = 6;
const PIN_MIN = 4;

// One screen, two ways in.
//
// Operators tap their name and a PIN; managers type a username and password. The brief
// lists these as two screens, but building them as two would mean two full page loads and
// two component trees for one decision — and on a till the operator path has to be the one
// that appears by default and costs no clicks to reach.
export default function LoginScreen() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState('pin'); // 'pin' | 'password'

  // PIN flow: pick a person, then type.
  const [operators, setOperators] = useState([]);
  const [operatorsError, setOperatorsError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState('');

  // Password flow.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // The name list is public by necessity — you cannot ask someone to type a PIN before
  // telling them whose PIN to type.
  useEffect(() => {
    let cancelled = false;
    authApi
      .operators()
      .then((list) => { if (!cancelled) setOperators(list); })
      .catch((err) => { if (!cancelled) setOperatorsError(err.message); });
    return () => { cancelled = true; };
  }, []);

  // One place where a sign-in completes, so both doors land the right person in the right
  // place. `replace` rather than push: Back should not return to a login screen the user
  // has already got past.
  async function signInAs(result) {
    await signIn(result);

    const role = result.user.role;

    // A deep link is honoured when this role may actually open it — the app being opened
    // at #/pos/history and signed into should not dump the manager on the dashboard. The
    // root path is excluded because it is the address the app launches at rather than a
    // destination anyone chose, and the role's own landing screen is the better answer
    // there: an operator wants the till, not a dashboard.
    const asked = location.pathname !== '/' && isAllowed(location.pathname, role);

    navigate(asked ? location.pathname : homeFor(role), { replace: true });
  }

  async function submitPin(event) {
    event?.preventDefault();
    if (busy || !selected || pin.length < PIN_MIN) return;

    setBusy(true);
    setError(null);
    try {
      await signInAs(await authApi.loginWithPin(selected.id, pin));
    } catch (err) {
      setError(err.message);
      setPin(''); // the whole PIN, not one digit — they can just retype it
      setBusy(false);
    }
  }

  async function submitPassword(event) {
    event.preventDefault();
    if (busy || !username.trim() || !password) return;

    setBusy(true);
    setError(null);
    try {
      await signInAs(await authApi.loginWithPassword(username.trim(), password));
    } catch (err) {
      setError(err.message);
      setPassword('');
      setBusy(false);
    }
  }

  function pressKey(key) {
    setError(null);
    if (key === 'back') setPin((p) => p.slice(0, -1));
    else setPin((p) => (p.length < PIN_MAX ? p + key : p));
  }

  // A keyboard is attached to the counter machine even though the keypad is on screen, and
  // typing a PIN is faster than clicking one. This mirrors what the on-screen keys do.
  //
  // Deliberately no dependency array: the listener has to see the current `pin` and
  // `selected` on every render, and re-subscribing is cheaper than threading refs through
  // to keep a stale closure fresh. react-hooks/exhaustive-deps flags this as a warning;
  // the tidy fix is useEffectEvent, which is React 19.2+ only.
  useEffect(() => {
    if (mode !== 'pin' || !selected) return;
    function onKeyDown(event) {
      if (event.key >= '0' && event.key <= '9') pressKey(event.key);
      else if (event.key === 'Backspace') pressKey('back');
      else if (event.key === 'Enter') submitPin();
      else if (event.key === 'Escape') { setSelected(null); setPin(''); setError(null); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Four slots to begin with, then one empty slot as a caret — so the length is never
  // shown as a fixed target. PINs here are 4 to 6 digits and a filled 4th slot must not
  // look like "done".
  const slots = Math.min(PIN_MAX, Math.max(PIN_MIN, pin.length + 1));

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>{BUSINESS_NAME}</div>

        {error && <Banner tone="danger">{error}</Banner>}

        {mode === 'pin' ? (
          selected ? (
            <form className={styles.panel} onSubmit={submitPin}>
              <button
                type="button"
                className={styles.who}
                onClick={() => { setSelected(null); setPin(''); setError(null); }}
                title="Choose someone else"
              >
                {selected.full_name || 'Unnamed'}
              </button>

              {/* role="status" so the count is announced as it changes. The dots are the
                  only feedback that a key press registered, and they are purely visual. */}
              <div
                className={styles.dots}
                role="status"
                aria-label={`${pin.length} digits entered`}
              >
                {Array.from({ length: slots }, (_, i) => (
                  <span
                    key={i}
                    className={i < pin.length ? styles.dotFilled : styles.dotEmpty}
                  />
                ))}
              </div>

              <div className={styles.keypad}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
                  <button key={key} type="button" className={styles.key} onClick={() => pressKey(key)}>
                    {key}
                  </button>
                ))}
                <span />
                <button type="button" className={styles.key} onClick={() => pressKey('0')}>0</button>
                <button
                  type="button"
                  className={styles.key}
                  onClick={() => pressKey('back')}
                  aria-label="Delete last digit"
                >
                  <Icon name="backspace" size={22} />
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                full
                disabled={pin.length < PIN_MIN || busy}
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          ) : (
            <div className={styles.panel}>
              <p className={styles.prompt}>Who is at the till?</p>

              {operatorsError && <Banner tone="warn">{operatorsError}</Banner>}

              {operators.length === 0 && !operatorsError ? (
                <p className={styles.hint}>
                  No till accounts yet. Use manager sign-in below to get started.
                </p>
              ) : (
                <div className={styles.people}>
                  {operators.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      className={styles.person}
                      onClick={() => { setSelected(person); setPin(''); setError(null); }}
                    >
                      <span className={styles.avatar}>
                        {(person.full_name || '?').charAt(0).toUpperCase()}
                      </span>
                      <span className={styles.personName}>{person.full_name || 'Unnamed'}</span>
                      {person.role === 'admin' && <span className={styles.adminTag}>Admin</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        ) : (
          <form className={styles.panel} onSubmit={submitPassword}>
            <p className={styles.prompt}>Manager sign-in</p>

            <Field label="Username">
              {/* autoFocus rather than a ref and an effect: this form mounts when the mode
                  flips, and autoFocus fires on mount, which is exactly the moment wanted. */}
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              full
              disabled={!username.trim() || !password || busy}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        )}

        <button
          type="button"
          className={styles.switch}
          onClick={() => { setMode(mode === 'pin' ? 'password' : 'pin'); setError(null); }}
        >
          {mode === 'pin' ? 'Manager sign-in' : 'Back to the till'}
        </button>
      </div>
    </div>
  );
}
