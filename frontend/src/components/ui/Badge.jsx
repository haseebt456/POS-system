import { cx } from '../../lib/cx';
import styles from './Badge.module.css';

// Replaces the four hand-rolled badge recipes: low-stock, KITCHEN/RECEIPT, the supplier
// "Owed" tag and the three print-status pills. Each was the same pill with different
// colours, written out separately.
function Badge({ tone = 'neutral', shape = 'pill', children, className, ...rest }) {
  return (
    <span className={cx(styles.badge, styles[tone], shape === 'square' && styles.square, className)} {...rest}>
      {children}
    </span>
  );
}

export default Badge;
