import { useState } from 'react';

const styles = {
  panel: { background: '#fff', border: '1px solid #2563eb', borderRadius: 12, padding: '18px 20px', marginBottom: 20 },
  heading: { fontSize: 15, fontWeight: 700, margin: '0 0 6px', color: '#22262b' },
  sub: { fontSize: 13, color: '#6b7280', margin: '0 0 16px' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 14 },
  th: {
    textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e5e7eb',
    color: '#6b7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  td: { padding: '9px 12px', borderBottom: '1px solid #f0f1f3' },
  input: { width: 110, padding: '7px 10px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 6, color: '#22262b', background: '#fff' },
  varianceUp: { color: '#15803d', fontWeight: 600 },
  varianceDown: { color: '#a32b1f', fontWeight: 600 },
  varianceSame: { color: '#9ca3af' },
  actions: { display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 },
  button: { padding: '11px 20px', fontSize: 15, fontWeight: 700, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' },
  buttonDisabled: { background: '#a8c5f5', cursor: 'not-allowed' },
  cancel: { padding: '11px 16px', fontSize: 14, fontWeight: 600, background: 'none', color: '#6b7280', border: 'none', cursor: 'pointer' },
  summary: { fontSize: 13, color: '#6b7280', marginLeft: 'auto' },
};

function StockCountPanel({ ingredients, onSubmit, onCancel, submitting }) {
  const [counts, setCounts] = useState({});

  // Only trackable items appear: untrackable ones (sauces, ketchup) have no
  // meaningful countable unit, so a "physical count" for them would be noise.
  const trackable = ingredients.filter((i) => i.is_trackable);

  function setCount(id, value) {
    setCounts((prev) => ({ ...prev, [id]: value }));
  }

  // Only rows the operator actually filled in are submitted — leaving a box blank
  // means "I didn't count this", not "this is now zero".
  const entries = trackable
    .filter((i) => counts[i.id] !== undefined && counts[i.id] !== '')
    .map((i) => ({ id: i.id, actual_qty: Number(counts[i.id]) }))
    .filter((e) => !Number.isNaN(e.actual_qty) && e.actual_qty >= 0);

  const changedCount = entries.filter((e) => {
    const current = trackable.find((i) => i.id === e.id)?.stock_qty;
    return current !== e.actual_qty;
  }).length;

  async function handleSubmit() {
    if (entries.length === 0) return;
    await onSubmit(entries);
    setCounts({});
  }

  return (
    <div style={styles.panel}>
      <div style={styles.heading}>Physical count</div>
      <div style={styles.sub}>
        Enter what you actually counted on the shelf. Only the rows you fill in are changed —
        leave a box blank to skip that item. This <strong>overwrites</strong> the system figure,
        so it is for counting, not for adding or removing stock.
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Ingredient</th>
            <th style={styles.th}>System says</th>
            <th style={styles.th}>Actual count</th>
            <th style={styles.th}>Difference</th>
          </tr>
        </thead>
        <tbody>
          {trackable.map((ing) => {
            const raw = counts[ing.id];
            const hasValue = raw !== undefined && raw !== '';
            const variance = hasValue ? Number(raw) - ing.stock_qty : null;

            return (
              <tr key={ing.id}>
                <td style={styles.td}>{ing.name}</td>
                <td style={styles.td}>{ing.stock_qty} {ing.unit}</td>
                <td style={styles.td}>
                  <input
                    style={styles.input} type="number" min="0" step="0.01" placeholder="—"
                    value={raw ?? ''}
                    onChange={(e) => setCount(ing.id, e.target.value)}
                  />
                </td>
                <td style={styles.td}>
                  {variance === null || Number.isNaN(variance)
                    ? <span style={styles.varianceSame}>—</span>
                    : variance === 0
                      ? <span style={styles.varianceSame}>no change</span>
                      : variance > 0
                        ? <span style={styles.varianceUp}>+{variance} {ing.unit}</span>
                        : <span style={styles.varianceDown}>{variance} {ing.unit}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={styles.actions}>
        <button
          style={{ ...styles.button, ...(entries.length === 0 || submitting ? styles.buttonDisabled : {}) }}
          disabled={entries.length === 0 || submitting}
          onClick={handleSubmit}
        >
          {submitting ? 'Saving…' : `Apply count (${entries.length})`}
        </button>
        <button style={styles.cancel} onClick={onCancel}>Cancel</button>
        {changedCount > 0 && (
          <span style={styles.summary}>{changedCount} of {entries.length} counted items will change</span>
        )}
      </div>
    </div>
  );
}

export default StockCountPanel;
