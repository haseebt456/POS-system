import { formatPrice } from './MenuGrid';

const styles = {
  panel: {
    background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12,
    padding: '16px 18px', boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
    display: 'flex', flexDirection: 'column', height: '100%',
  },
  title: { fontSize: 15, fontWeight: 700, marginBottom: 12 },
  empty: { fontSize: 14, color: '#9ca3af', flex: 1 },
  lines: { flex: 1, overflowY: 'auto', marginBottom: 12 },
  line: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f1f3' },
  lineName: { fontSize: 14, fontWeight: 600 },
  lineDealTag: { fontSize: 11, color: '#92400e', fontWeight: 700 },
  qtyControls: { display: 'flex', alignItems: 'center', gap: 8 },
  qtyButton: {
    width: 26, height: 26, borderRadius: 6, border: '1px solid #d1d5db',
    background: '#fafafa', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
  removeButton: { background: 'none', border: 'none', color: '#dc2626', fontSize: 13, cursor: 'pointer', marginLeft: 10 },
  totalRow: { display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, padding: '10px 0', borderTop: '2px solid #e5e7eb' },
  submitButton: {
    padding: '13px 0', fontSize: 15, fontWeight: 700, background: '#16a34a', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', marginTop: 8,
  },
  submitButtonDisabled: { background: '#a7d8b8', cursor: 'not-allowed' },
};

function Cart({ lines, onChangeQty, onRemove, onSubmit, submitting }) {
  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);

  return (
    <div style={styles.panel}>
      <div style={styles.title}>Current Order</div>

      {lines.length === 0 ? (
        <p style={styles.empty}>Tap a menu item or deal to add it here.</p>
      ) : (
        <div style={styles.lines}>
          {lines.map((line) => (
            <div key={line.key} style={styles.line}>
              <div>
                <div style={styles.lineName}>{line.name}</div>
                {line.type === 'deal' && <div style={styles.lineDealTag}>DEAL</div>}
              </div>
              <div style={styles.qtyControls}>
                <button style={styles.qtyButton} onClick={() => onChangeQty(line.key, line.quantity - 1)}>−</button>
                <span>{line.quantity}</span>
                <button style={styles.qtyButton} onClick={() => onChangeQty(line.key, line.quantity + 1)}>+</button>
                <span>{formatPrice(line.quantity * line.unitPriceCents)}</span>
                <button style={styles.removeButton} onClick={() => onRemove(line.key)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={styles.totalRow}>
        <span>Total</span>
        <span>{formatPrice(total)}</span>
      </div>

      <button
        style={{ ...styles.submitButton, ...(lines.length === 0 || submitting ? styles.submitButtonDisabled : {}) }}
        disabled={lines.length === 0 || submitting}
        onClick={onSubmit}
      >
        {submitting ? 'Submitting…' : 'Submit Order'}
      </button>
    </div>
  );
}

export default Cart;
