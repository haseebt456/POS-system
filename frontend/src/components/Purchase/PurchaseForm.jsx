import { useState } from 'react';

const styles = {
  panel: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', marginBottom: 20 },
  heading: { fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 },
  label: { display: 'block', fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 4 },
  field: { marginBottom: 12 },
  select: { width: '100%', maxWidth: 320, padding: '10px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#22262b', background: '#fafafa' },
  lineRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
  lineSelect: { flex: '1 1 220px', padding: '9px 11px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#22262b', background: '#fafafa' },
  lineInput: { flex: '0 1 110px', padding: '9px 11px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#22262b', background: '#fafafa' },
  lineMeta: { flex: '0 0 90px', fontSize: 13, color: '#6b7280', textAlign: 'right' },
  remove: { padding: '9px 12px', fontSize: 13, fontWeight: 600, background: '#fff', color: '#a32b1f', border: '1px solid #f3c8c2', borderRadius: 8, cursor: 'pointer' },
  addLine: { padding: '8px 14px', fontSize: 13, fontWeight: 600, background: '#fff', color: '#2563eb', border: '1px dashed #93b4f5', borderRadius: 8, cursor: 'pointer' },
  totalBar: { display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end', borderTop: '1px solid #f0f1f3', paddingTop: 14, marginTop: 14 },
  summary: { fontSize: 14, color: '#22262b' },
  summaryStrong: { fontSize: 15, fontWeight: 700 },
  button: { padding: '10px 18px', fontSize: 14, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' },
  hint: { fontSize: 12, color: '#9ca3af', marginTop: 6 },
};

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
    <div style={styles.panel}>
      <div style={styles.heading}>Record a purchase</div>
      <form onSubmit={handleSubmit}>
        <div style={styles.field}>
          <label style={styles.label}>Supplier</label>
          <select style={styles.select} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Items received</label>
          {lines.map((line, index) => (
            <div key={index} style={styles.lineRow}>
              <select
                style={styles.lineSelect}
                value={line.ingredient_id}
                onChange={(e) => updateLine(index, { ingredient_id: e.target.value })}
              >
                <option value="">Select ingredient…</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                ))}
              </select>
              <input
                style={styles.lineInput}
                type="number" min="0" step="0.01" placeholder="Qty"
                value={line.quantity}
                onChange={(e) => updateLine(index, { quantity: e.target.value })}
              />
              <input
                style={styles.lineInput}
                type="number" min="0" step="0.01" placeholder="Rs. / unit"
                value={line.unit_cost}
                onChange={(e) => updateLine(index, { unit_cost: e.target.value })}
              />
              <span style={styles.lineMeta}>
                {line.quantity && line.unit_cost
                  ? `Rs. ${(Math.round(Number(line.quantity) * Number(line.unit_cost) * 100) / 100).toLocaleString()}`
                  : '—'}
              </span>
              <button type="button" style={styles.remove} onClick={() => removeLine(index)}>Remove</button>
            </div>
          ))}
          <button type="button" style={styles.addLine} onClick={addLine}>+ Add another item</button>
        </div>

        <div style={styles.totalBar}>
          <div style={styles.field}>
            <label style={styles.label}>Paid upfront (Rs.)</label>
            <input
              style={styles.lineInput}
              type="number" min="0" step="0.01" placeholder="0"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
            />
            <div style={styles.hint}>Leave blank if nothing was paid now.</div>
          </div>
          <div style={styles.summary}>
            <div>Purchase total: <strong>Rs. {(totalCents / 100).toLocaleString()}</strong></div>
            <div style={styles.summaryStrong}>
              {owedCents >= 0
                ? <>Added to supplier balance: Rs. {(owedCents / 100).toLocaleString()}</>
                : <>Overpaid by Rs. {(-owedCents / 100).toLocaleString()} — this will reduce an existing balance.</>}
            </div>
          </div>
          <button type="submit" style={styles.button} disabled={submitting}>
            {submitting ? 'Saving…' : 'Record purchase'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PurchaseForm;
