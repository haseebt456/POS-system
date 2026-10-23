import { cloneElement, isValidElement, useId } from 'react';
import { cx } from '../../lib/cx';
import styles from './Field.module.css';

// A labelled form control: label above, control, then either the error or the hint.
//
// This exists mainly to fix an accessibility gap. Every input in the app used a
// placeholder and nothing else — no <label> anywhere except one checkbox — so a screen
// reader announced an unnamed text box. Placeholders are also the wrong tool for the job:
// they vanish the moment the operator starts typing, taking the field's meaning with them.
//
// It also wires the error message to the control, so the message is announced with the
// field rather than being an unrelated red string floating underneath it.
//
// Contract: `children` should be an <Input> or <Select> from this folder, because Field
// passes them an `invalid` prop to drive the error styling. A raw DOM element would get
// `invalid` as a stray attribute.
function Field({ label, error, hint, children, className }) {
  const generatedId = useId();
  const controlId = (isValidElement(children) && children.props.id) || generatedId;
  const errorId = `${controlId}-error`;
  const hintId = `${controlId}-hint`;

  // The error replaces the hint rather than stacking with it — two lines of small grey
  // and red text under one input is noise, and the error is the one that matters.
  const describedBy = error ? errorId : hint ? hintId : undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        invalid: Boolean(error),
        'aria-describedby': describedBy,
      })
    : children;

  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
      </label>
      {control}
      {error ? (
        <span id={errorId} className={styles.error}>
          {error}
        </span>
      ) : hint ? (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export default Field;
