import { cx } from '../../lib/cx';
import styles from './Button.module.css';

// The app's only button. Variants cover everything the five screens do today:
//   primary     — the main action in a panel (Add supplier, Save payment)
//   success     — Submit Order, the one green in the app
//   danger      — a solid destructive confirm (Retry printing in the failure banner)
//   secondary   — Cancel, "Physical count", anything bordered
//   ghost       — row actions in tables (Edit, View items)
//   dangerGhost — row actions that destroy (Remove)
//
// `type` defaults to "button", NOT the HTML default of "submit". A bare <button> inside
// a <form> submits it, which is why the original code had to remember type="button" on
// every Cancel. Defaulting to the safe value means the submit button is the one that has
// to say so out loud.
function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  full = false,
  className,
  ...rest
}) {
  return (
    <button
      type={type}
      className={cx(styles.btn, styles[size], styles[variant], full && styles.full, className)}
      {...rest}
    />
  );
}

export default Button;
