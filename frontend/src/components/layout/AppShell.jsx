import { useMemo } from 'react';
import { matchPath, Outlet, useLocation } from 'react-router-dom';
import { cx } from '../../lib/cx';
import { useAuth } from '../../auth/AuthContext';
import { leaves, navForRole } from '../../routes';
import Sidebar from './Sidebar';
import styles from './AppShell.module.css';

// The frame every signed-in screen renders inside: a floating sidebar panel and the
// content area beside it.
//
// `fill` comes from the route definition, not from the screen. A screen that manages its
// own internal scrolling (the till) needs the *remaining height*, not a scrolling
// document — and if the screen decided that for itself by inspecting its own content, the
// decision would be invisible from the nav and would flip the moment the content changed
// height. Declaring it next to the route keeps it a property of the destination.
function AppShell() {
  const { user, isAdmin, signOut } = useAuth();
  const location = useLocation();

  const groups = useMemo(() => navForRole(user.role), [user.role]);

  const active = leaves().find((leaf) =>
    matchPath({ path: leaf.path, end: true }, location.pathname)
  );

  return (
    <div className={styles.shell}>
      <div className={styles.sidebarSlot}>
        <Sidebar
          groups={groups}
          role={user.role}
          user={user}
          isAdmin={isAdmin}
          onSignOut={signOut}
        />
      </div>

      <main className={cx(styles.main, active?.fill && styles.mainFill)}>
        <Outlet />
      </main>
    </div>
  );
}

export default AppShell;
