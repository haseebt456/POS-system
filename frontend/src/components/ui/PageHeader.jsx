import { cx } from '../../lib/cx';
import styles from './PageHeader.module.css';

// Three screens rendered a bare <h1>, and Inventory rendered its own header with a count
// and a button on the right. This is that, once, so page titles line up at the same
// height and weight across every tab.
function PageHeader({ title, meta, actions, className, ...rest }) {
  return (
    <header className={cx(styles.header, className)} {...rest}>
      <div className={styles.left}>
        <h1 className={styles.title}>{title}</h1>
        {meta && <span className={styles.meta}>{meta}</span>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

export default PageHeader;
