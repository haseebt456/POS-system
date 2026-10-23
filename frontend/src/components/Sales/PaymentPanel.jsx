import { useMemo, useState } from 'react';
import { Button, Field, Input, SlideOver } from '../ui';
import { cx } from '../../lib/cx';
import { formatMoney } from '../../lib/money';
import styles from './PaymentPanel.module.css';

// The step between a filled cart and a committed order: how it was paid, and what came off it.
//
// It is a slide-over rather than a screen of its own because the cart has to stay readable
// behind it. An operator taking Rs. 2,000 in cash is looking at the total while they count it.

// Rupees in, integer cents out — the only place the till converts between the two.
//
// null means "nothing to convert", and the caller distinguishes "the box is empty" from "that
// is not a number" by looking at the raw string. That distinction matters: an empty discount
// box is an order with no discount, and a discount box containing "12x" is a typo that must be
// refused rather than quietly read as Rs. 12 — which is what parseFloat would do.
function rupeesToCents(input) {
  const text = String(input ?? '').trim();
  if (text === '') return null;

  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return null;

  return Math.round(value * 100);
}

// Round cash amounts a customer is likely to hand over. Built from the total rather than
// hard-coded, so a Rs. 5,300 order offers 5,500 and 6,000 rather than 500 and 1,000.
function quickTenders(payableCents) {
  const options = [payableCents];
  for (const step of [50000, 100000, 500000]) {
    const rounded = Math.ceil(payableCents / step) * step;
    if (rounded > payableCents && !options.includes(rounded)) options.push(rounded);
  }
  return options.slice(0, 4);
}

function PaymentPanel({ totalCents, methods, config, onConfirm, onCancel, submitting, error }) {
  const [methodId, setMethodId] = useState(() => methods[0]?.id ?? '');
  const [orderType, setOrderType] = useState(config?.default_order_type ?? 'takeaway');
  const [discountInput, setDiscountInput] = useState('');
  const [reason, setReason] = useState('');
  const [tenderedInput, setTenderedInput] = useState('');

  const discountCents = rupeesToCents(discountInput);
  const discountNotANumber = discountInput.trim() !== '' && discountCents === null;

  // null on the config means "no ceiling" — an admin. 0 means operators may not discount at
  // all, which is the seeded default, so this is the state a fresh install opens in rather
  // than a corner case.
  const capCents = config?.discount_cap_cents ?? null;
  const capExceeded = capCents !== null && discountCents !== null && discountCents > capCents;

  const method = methods.find((m) => String(m.id) === String(methodId));
  const isCash = Boolean(method?.is_cash);

  const applied = discountNotANumber || capExceeded ? 0 : discountCents ?? 0;
  const overTotal = applied > totalCents;
  const payableCents = Math.max(totalCents - applied, 0);

  // Tendered is only meaningful for cash; a card produces no change. The backend accepts null
  // here and stores null, which is what keeps "change given" off a card order's history row.
  const tenderedCents = isCash ? rupeesToCents(tenderedInput) : null;
  const tenderedNotANumber = isCash && tenderedInput.trim() !== '' && tenderedCents === null;
  const tenderedShort = isCash && tenderedCents !== null && tenderedCents < payableCents;
  const changeCents = tenderedCents !== null && !tenderedShort ? tenderedCents - payableCents : null;

  const needsReason = applied > 0 && reason.trim() === '';

  const problem = useMemo(() => {
    if (!methodId) return 'Choose how the order was paid';
    if (discountNotANumber) return 'The discount is not a number';
    if (capExceeded) {
      return capCents === 0
        ? 'Your account cannot give discounts — ask a manager'
        : `You can take up to ${formatMoney(capCents)} off an order`;
    }
    if (overTotal) return 'The discount is larger than the order total';
    if (needsReason) return 'A discount needs a reason';
    if (tenderedNotANumber) return 'The cash received is not a number';
    if (tenderedShort) return `That is less than the ${formatMoney(payableCents)} due`;
    return null;
  }, [
    methodId, discountNotANumber, capExceeded, capCents, overTotal, needsReason,
    tenderedNotANumber, tenderedShort, payableCents,
  ]);

  function confirm() {
    if (problem) return;
    onConfirm({
      order_type: orderType,
      payment_method_id: Number(methodId),
      discount_cents: applied,
      // Only sent when there is something to explain. Sending an empty string would store one,
      // and the history renders a reason it was given rather than one it has to judge.
      discount_reason: applied > 0 ? reason.trim() : null,
      amount_tendered_cents: tenderedCents,
    });
  }

  return (
    <SlideOver
      title="Take payment"
      subtitle={`${formatMoney(totalCents)} due`}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="success" onClick={confirm} disabled={submitting || Boolean(problem)}>
            {submitting ? 'Saving…' : 'Confirm order'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {/* A server refusal — the cap, most often — lands here. The client checks the same
            rules, so this is either a race or a client that has drifted from the server, and
            in both cases repeating what the server said is the only honest thing to show. */}
        {error && <p className={styles.serverError}>{error}</p>}

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Order type</h3>
          <div className={styles.segmented}>
            {[
              { value: 'takeaway', label: 'Takeaway' },
              { value: 'dine-in', label: 'Dine-in' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={cx(styles.segment, orderType === option.value && styles.segmentActive)}
                aria-pressed={orderType === option.value}
                onClick={() => setOrderType(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Paid by</h3>
          <div className={styles.methods}>
            {methods.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cx(styles.method, String(option.id) === String(methodId) && styles.methodActive)}
                aria-pressed={String(option.id) === String(methodId)}
                onClick={() => setMethodId(option.id)}
              >
                {option.name}
              </button>
            ))}
          </div>
          {methods.length === 0 && (
            <p className={styles.note}>
              No payment methods are set up. An administrator can add one in Settings.
            </p>
          )}
        </section>

        {isCash && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Cash received</h3>
            <Field
              label="Amount handed over"
              hint={tenderedInput.trim() === '' ? 'Leave empty to record it without change' : undefined}
              error={tenderedNotANumber ? 'Not a number' : tenderedShort ? 'Less than the total' : undefined}
            >
              <Input
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                placeholder="0"
                value={tenderedInput}
                onChange={(e) => setTenderedInput(e.target.value)}
              />
            </Field>

            <div className={styles.quickRow}>
              {quickTenders(payableCents).map((amount, index) => (
                <Button
                  key={amount}
                  size="sm"
                  variant="secondary"
                  onClick={() => setTenderedInput(String(amount / 100))}
                >
                  {index === 0 ? 'Exact' : formatMoney(amount)}
                </Button>
              ))}
            </div>

            {changeCents !== null && (
              <div className={styles.change}>
                <span>Change</span>
                <strong>{formatMoney(changeCents)}</strong>
              </div>
            )}
          </section>
        )}

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Discount</h3>

          {capCents === 0 ? (
            <p className={styles.note}>
              Your account cannot give discounts. A manager can apply one, or raise your limit in
              Settings.
            </p>
          ) : (
            <>
              <Field
                label="Amount off"
                hint={
                  capCents !== null
                    ? `Up to ${formatMoney(capCents)} without a manager`
                    : 'No limit on your account'
                }
                error={
                  discountNotANumber
                    ? 'Not a number'
                    : capExceeded
                      ? 'Above your limit'
                      : overTotal
                        ? 'More than the order total'
                        : undefined
                }
              >
                <Input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  placeholder="0"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                />
              </Field>

              {/* Only asked for once there is something to explain. A reason box sitting under
                  a zero discount is a field the operator learns to skip. */}
              {applied > 0 && (
                <Field
                  label="Reason"
                  hint="Kept on the order and in the activity log"
                  error={needsReason ? 'Say why the discount was given' : undefined}
                >
                  <Input
                    value={reason}
                    maxLength={120}
                    placeholder="Damaged item, regular customer…"
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
              )}
            </>
          )}
        </section>

        <dl className={styles.summary}>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(totalCents)}</dd>
          </div>
          {applied > 0 && (
            <div className={styles.discountRow}>
              <dt>Discount</dt>
              <dd>−{formatMoney(applied)}</dd>
            </div>
          )}
          <div className={styles.totalRow}>
            <dt>Total</dt>
            <dd>{formatMoney(payableCents)}</dd>
          </div>
        </dl>

        {problem && <p className={styles.problem}>{problem}</p>}
      </div>
    </SlideOver>
  );
}

export default PaymentPanel;
