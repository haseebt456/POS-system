import { cx } from '../../lib/cx';
import styles from './Table.module.css';

// Table primitives, not a data grid. Five tables in this app share a look but differ in
// columns, in whether rows expand, and in what a row's actions are — a column-spec API
// would have to model all of that to save nothing. `<Table>` + `<Th>` + `<Td>` capture
// the shared part and leave the structure at the call site.
//
// `align` is destructured out so it styles the cell without reaching the DOM as the
// deprecated `align` attribute.

export function Table({ children, className, ...rest }) {
  return (
    <div className={styles.wrapper}>
      <table className={cx(styles.table, className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function Th({ align = 'left', children, className, ...rest }) {
  return (
    <th className={cx(styles.th, styles[align], className)} {...rest}>
      {children}
    </th>
  );
}

export function Td({ align, children, className, ...rest }) {
  return (
    <td className={cx(styles.td, align && styles[align], className)} {...rest}>
      {children}
    </td>
  );
}
