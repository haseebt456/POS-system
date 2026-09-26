const styles = {
  formSection: {
    marginBottom: 28,
    background: '#ffffff',
    padding: '18px 20px',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
  },
  formHeading: {
    fontSize: 13,
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  form: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  inputName: {
    flex: '1 1 220px', padding: '11px 14px', fontSize: 15,
    border: '1px solid #d1d5db', borderRadius: 8, outline: 'none',
    background: '#fafafa', color: '#22262b',
  },
  inputSmall: {
    flex: '0 1 140px', padding: '11px 14px', fontSize: 15,
    border: '1px solid #d1d5db', borderRadius: 8, outline: 'none',
    background: '#fafafa', color: '#22262b',
  },
  inputError: { border: '1px solid #dc2626', background: '#fef2f2' },
  fieldErrorText: { fontSize: 12, color: '#dc2626' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#4a4a4a', padding: '0 4px' },
  addButton: {
    padding: '11px 20px', fontSize: 15, fontWeight: 600, background: '#2563eb',
    color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(37, 99, 235, 0.3)',
  },
  cancelButton: {
    padding: '11px 18px', fontSize: 15, fontWeight: 600, background: '#fff',
    color: '#4a4a4a', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer',
  },
  hint: {
    marginTop: 12, marginBottom: 0, fontSize: 13, color: '#9a6b00',
    background: '#fffbeb', padding: '8px 12px', borderRadius: 6, border: '1px solid #fde68a',
  },
};

function IngredientForm({ form, setForm, fieldErrors, editingId, onSubmit, onCancel }) {
  return (
    <section style={styles.formSection}>
      <div style={styles.formHeading}>
        {editingId === null ? 'Add ingredient' : `Editing: ${form.name || '…'}`}
      </div>
      <form onSubmit={onSubmit} style={styles.form}>
        <div style={styles.fieldGroup}>
          <input
            style={{ ...styles.inputName, ...(fieldErrors.name ? styles.inputError : {}) }}
            type="text"
            placeholder="Ingredient name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          {fieldErrors.name && <span style={styles.fieldErrorText}>{fieldErrors.name}</span>}
        </div>

        <select style={styles.inputSmall} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
          <option value="kg">kg</option>
          <option value="g">g</option>
          <option value="l">l</option>
          <option value="ml">ml</option>
          <option value="pcs">pcs</option>
        </select>

        <div style={styles.fieldGroup}>
          <input
            style={{ ...styles.inputSmall, ...(fieldErrors.stock_qty ? styles.inputError : {}) }}
            type="number"
            step="any"
            placeholder={editingId === null ? 'Starting stock' : 'Correct stock to…'}
            value={form.stock_qty}
            onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
          />
          {fieldErrors.stock_qty && <span style={styles.fieldErrorText}>{fieldErrors.stock_qty}</span>}
        </div>

        <div style={styles.fieldGroup}>
          <input
            style={{ ...styles.inputSmall, ...(fieldErrors.low_stock_threshold ? styles.inputError : {}) }}
            type="number"
            step="any"
            placeholder="Low stock alert at"
            value={form.low_stock_threshold}
            onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
          />
          {fieldErrors.low_stock_threshold && <span style={styles.fieldErrorText}>{fieldErrors.low_stock_threshold}</span>}
        </div>

        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={form.is_trackable}
            onChange={(e) => setForm({ ...form, is_trackable: e.target.checked })}
          />
          Track stock automatically
        </label>

        <button type="submit" style={styles.addButton}>
          {editingId === null ? 'Add ingredient' : 'Save changes'}
        </button>
        {editingId !== null && (
          <button type="button" style={styles.cancelButton} onClick={onCancel}>Cancel</button>
        )}
      </form>
      {editingId !== null && (
        <p style={styles.hint}>
          Changing "stock" here overwrites the count directly — use this after a physical check, not for routine sales or purchases.
        </p>
      )}
    </section>
  );
}

export default IngredientForm;
