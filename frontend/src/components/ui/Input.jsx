import { cx } from '../../lib/cx';
import styles from './Input.module.css';

// Text/number inputs and selects share one visual treatment — they were `input`,
// `inputSmall` and `inputName` across six files, differing only in flex-basis, which is
// the layout's business and belongs at the call site, not in the control.
//
// `invalid` is what Field passes down when there's an error; it's also usable directly
// when a control isn't wrapped in a Field.

export function Input({ invalid, className, ...rest }) {
  return (
    <input
      className={cx(styles.control, invalid && styles.invalid, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Select({ invalid, className, children, ...rest }) {
  return (
    <select
      className={cx(styles.control, invalid && styles.invalid, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}
