import { useState } from 'react';
import { formatMoney } from '../../lib/money';
import { Panel, Field, Input, Select, Button } from '../ui';
import styles from './PurchaseForm.module.css';

const emptyLine = () => ({ ingredient_id: '', quantity: '', unit_cost: '' });

// One row per ingredient received. Kept as local state rather than a child
// component so the whole form stays a single uncontrolled-then-submitted unit,
// matching DealForm's shape but with the multi-line handling DealItemsManager needs.
function PurchaseForm({ suppliers = [], ingredients = [], onCreate }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [lines, setLines] = useState([emptyLine()]);
  const [amountPaid, setAmountPaid] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateLine(index, patch) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index) {
    setLines((prev) => (prev.length === 1 ? [emptyLine()] : prev.filter((_, i) => i !== index)));
  }

  // Live preview only. The authoritative total is computed server-side in
  // createPurchase — this exists so the operator sees the consequence of what
  // they typed before committing, not to be the source of truth.
  const totalCents = lines.reduce((sum, line) => {
    const qty = Number(line.quantity);
    const cost = Number(line.unit_cost);
    if (!qty || !cost) return sum;
    return sum + Math.round(qty * cost * 100);
  }, 0);

  const paidCents = amountPaid === '' ? 0 : Math.round(Number(amountPaid) * 100);
  const owedCents = totalCents - paidCents;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!supplierId) return;

    // Rows the operator left blank are dropped rather than rejected — typing a
    // few and abandoning the rest is normal, and the backend already rejects a
    // genuinely empty purchase with a real message.
    const items = lines
      .filter((line) => line.ingredient_id && Number(line.quantity) > 0 && Number(line.unit_cost) > 0)
      .map((line) => ({
        ingredient_id: Number(line.ingredient_id),
        quantity: Number(line.quantity),
        unit_cost_cents: Math.round(Number(line.unit_cost) * 100),
      }));

    if (items.length === 0) return;

    setSubmitting(true);
    try {
      await onCreate({
        supplier_id: Number(supplierId),
        items,
        amount_paid_cents: paidCents,
      });
      setLines([emptyLine()]);
      setAmountPaid('');
    } catch {
      // PurchaseScreen already surfaced the reason. Leaving the typed rows alone means
      // the operator can fix the cause and resubmit instead of retyping the delivery.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel title="Record a purchase">
      <form onSubmit={handleSubmit} className={styles.grid}>
        <Field label="Supplier">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Items received</legend>

          {/* Repeated rows can't each carry a visible label without turning the form into
              a wall of text, so the column headings carry it for sighted users and
              aria-label carries it for everyone else. */}
          <div className={styles.lineHead} aria-hidden="true">
            <span>Ingredient</span>
            <span>Qty</span>
            <span>Rs. / unit</span>
            <span className={styles.right}>Line total</span>
            <span />
          </div>

          {lines.map((line, index) => (
            <div key={index} className={styles.lineRow}>
              <Select
                aria-label={`Ingredient for line ${index + 1}`}
                value={line.ingredient_id}
                onChange={(e) => updateLine(index, { ingredient_id: e.target.value })}
              >
                <option value="">Select ingredient…</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                ))}
              </Select>
              <Input
                aria-label={`Quantity for line ${index + 1}`}
                type="number" min="0" step="0.01" placeholder="Qty"
                value={line.quantity}
                onChange={(e) => updateLine(index, { quantity: e.target.value })}
              />
              <Input
                aria-label={`Unit cost for line ${index + 1}`}
                type="number" min="0" step="0.01" placeholder="0.00"
                value={line.unit_cost}
                onChange={(e) => updateLine(index, { unit_cost: e.target.value })}
              />
              <span className={styles.lineTotal}>
                {line.quantity && line.unit_cost
                  ? formatMoney(Math.round(Number(line.quantity) * Number(line.unit_cost) * 100))
                  : '—'}
              </span>
              <Button
                variant="dangerGhost"
                size="sm"
                aria-label={`Remove line ${index + 1}`}
                onClick={() => removeLine(index)}
              >
                Remove
              </Button>
            </div>
          ))}

          <Button variant="secondary" size="sm" className={styles.addLine} onClick={addLine}>
            + Add another item
          </Button>
        </fieldset>

        <div className={styles.totalBar}>
          <Field
            label="Paid upfront (Rs.)"
            hint="Leave blank if nothing was paid now."
            className={styles.paid}
          >
            <Input
              type="number" min="0" step="0.01" placeholder="0"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
            />
          </Field>

          <div className={styles.summary}>
            <div>
              Purchase total: <strong>{formatMoney(totalCents)}</strong>
            </div>
            <div className={styles.summaryStrong}>
              {owedCents >= 0
                ? <>Added to supplier balance: {formatMoney(owedCents)}</>
                : <>Overpaid by {formatMoney(-owedCents)} — this will reduce an existing balance.</>}
            </div>
          </div>

          <Button type="submit" variant="primary" className={styles.submit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Record purchase'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export default PurchaseForm;
