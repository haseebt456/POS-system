import { cx } from '../../lib/cx';
import styles from './Panel.module.css';

// The white bordered box that was copy-pasted into six files with a slightly different
// padding each time. `title` and `actions` are the two things every caller was already
// putting at the top of it; anything else goes in as children.
//
// `flush` drops the padding for content that supplies its own — a list whose rows are
// full width, or a table that should run to the panel's edge.
//
// `tone="deal"` tints the panel. Both are props rather than a caller-supplied className
// because they set properties this module also sets, and the winner between two modules
// would come down to stylesheet order.
function Panel({ title, actions, flush, tone, children, className, ...rest }) {
  const hasHeader = Boolean(title || actions);

  return (
    <section
      className={cx(styles.panel, flush && styles.flush, tone && styles[tone], className)}
      {...rest}
    >
      {hasHeader && (
        <header className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export default Panel;
