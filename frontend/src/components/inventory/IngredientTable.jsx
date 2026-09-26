const styles = {
  muted: { color: '#8a8a8a', fontSize: 14, padding: '8px 4px' },
  table: {
    width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 15,
    background: '#ffffff', borderRadius: 12, overflow: 'hidden',
    border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
  },
  th: {
    textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid #e5e7eb',
    color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase',
    letterSpacing: '0.04em', background: '#fafbfc',
  },
  td: { padding: '13px 16px', borderBottom: '1px solid #f0f1f3' },
  rowLow: { background: '#fff8e1' },
  lowBadge: {
    marginLeft: 10, fontSize: 11, color: '#9a6b00', fontWeight: 700,
    background: '#fef3c7', padding: '2px 8px', borderRadius: 999, letterSpacing: '0.02em',
  },
  actionsCell: { textAlign: 'right', whiteSpace: 'nowrap' },
  linkButton: { background: 'none', border: 'none', color: '#2563eb', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '4px 8px' },
  linkButtonDanger: { background: 'none', border: 'none', color: '#dc2626', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '4px 8px' },
};

function IngredientTable({ ingredients, lowStockIds, loading, onEdit, onDeactivate }) {
  if (loading) return <p style={styles.muted}>Loading…</p>;
  if (ingredients.length === 0) return <p style={styles.muted}>No ingredients yet. Add your first one above.</p>;

  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Name</th>
          <th style={styles.th}>Stock</th>
          <th style={styles.th}>Unit</th>
          <th style={styles.th}>Tracked</th>
          <th style={styles.th}></th>
        </tr>
      </thead>
      <tbody>
        {ingredients.map((ing) => {
          const isLow = lowStockIds.has(ing.id);
          return (
            <tr key={ing.id} style={isLow ? styles.rowLow : undefined}>
              <td style={styles.td}>{ing.name}</td>
              <td style={styles.td}>
                {ing.stock_qty}
                {isLow && <span style={styles.lowBadge}>Low stock</span>}
              </td>
              <td style={styles.td}>{ing.unit}</td>
              <td style={styles.td}>{ing.is_trackable ? 'Yes' : 'No'}</td>
              <td style={{ ...styles.td, ...styles.actionsCell }}>
                <button style={styles.linkButton} onClick={() => onEdit(ing)}>Edit</button>
                <button style={styles.linkButtonDanger} onClick={() => onDeactivate(ing.id, ing.name)}>Remove</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default IngredientTable;
