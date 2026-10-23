import { cx } from '../../lib/cx';
import styles from './Banner.module.css';

// The error strip that five screens each wrote out by hand, plus the info strip on the
// Printers screen and the "no suppliers yet" warning on Purchases.
//
// A danger banner gets role="alert" so a screen reader announces a failure as soon as it
// appears — these always show up in response to an action, so the user needs to know.
// The other tones are static guidance that's already on screen, and announcing them on
// mount would just be noise.
function Banner({ tone = 'danger', title, actions, children, className, ...rest }) {
  return (
    <div
      className={cx(styles.banner, styles[tone], className)}
      role={tone === 'danger' ? 'alert' : undefined}
      {...rest}
    >
      {title && <div className={styles.title}>{title}</div>}
      {children && <div className={styles.body}>{children}</div>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

export default Banner;
