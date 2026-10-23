import { NavLink } from 'react-router-dom';
import { cx } from '../../lib/cx';
import { BUSINESS_NAME } from '../../lib/business';
import Icon from '../ui/Icon';
import { labelFor } from '../../routes';
import styles from './Sidebar.module.css';

// The nav, plus who is signed in.
//
// There is no top header in this shell. The reference has one, and at 900x600 a 52px
// horizontal band is real estate the till cannot spare — so the signed-in user, their role
// and Sign out live in the sidebar's footer instead, where they cost no vertical space on
// the content side. Screens render their own PageHeader, which is why the shell has no
// title of its own: two titles for one screen is worse than none.
//
// A group whose single child shares its name renders as one plain item with no heading
// above it. "Dashboard / Dashboard" is noise; "POS / New Order" is not.
function Sidebar({ groups, role, user, isAdmin, onSignOut }) {
  const name = user.full_name || user.username || 'Signed in';

  return (
    <nav className={styles.sidebar} aria-label="Sections">
      <div className={styles.brand}>
        <span className={styles.brandMark}>L</span>
        <span className={styles.brandName}>{BUSINESS_NAME}</span>
      </div>

      {/* Only the nav scrolls. The wordmark stays put at the top and the user block stays
          put at the bottom, so neither can be scrolled out of reach on a short window. */}
      <div className={styles.scroll}>
        {groups.map((group) => {
          const solo =
            group.children.length === 1 && group.children[0].label === group.label;

          return (
            <div key={group.id} className={styles.group}>
              {!solo && <div className={styles.groupLabel}>{group.label}</div>}

              <ul className={styles.items}>
                {group.children.map((child) => {
                  const label = labelFor(child, role);

                  return (
                    <li key={child.id}>
                      {/* `end` on every link: these are all exact destinations, and
                          without it /pos would also light up while on /pos/history. */}
                      <NavLink
                        to={child.path}
                        end
                        className={({ isActive }) =>
                          cx(styles.item, isActive && styles.active)
                        }
                        // The label is hidden when the sidebar collapses to icons, so
                        // the title is the only thing naming the destination there.
                        title={label}
                      >
                        <span className={styles.bullet}>
                          <Icon name={group.icon} size={17} />
                        </span>
                        <span className={styles.itemLabel}>{label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className={styles.footer}>
        <span className={styles.avatar} aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className={styles.footerText}>
          <span className={styles.footerName}>{name}</span>
          <span className={styles.footerRole}>{isAdmin ? 'Admin' : 'Operator'}</span>
        </span>
        <button
          type="button"
          className={styles.signOut}
          onClick={onSignOut}
          title="Sign out"
          aria-label="Sign out"
        >
          <Icon name="logout" size={17} />
        </button>
      </div>
    </nav>
  );
}

export default Sidebar;
