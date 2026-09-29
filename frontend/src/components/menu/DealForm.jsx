import { useState } from 'react';

const styles = {
  panel: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', marginBottom: 20 },
  heading: { fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 },
  form: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  input: { flex: '1 1 200px', padding: '10px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#22262b', background: '#fafafa' },
  inputSmall: { flex: '0 1 130px', padding: '10px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#22262b', background: '#fafafa' },
  button: { padding: '10px 18px', fontSize: 14, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' },
};

function DealForm({ onCreate }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !price) return;
    await onCreate({ name: name.trim(), price_cents: Math.round(Number(price) * 100) });
    setName(''); setPrice('');
  }

  return (
    <div style={styles.panel}>
      <div style={styles.heading}>Add deal</div>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input style={styles.input} placeholder="Name (e.g. Burger Combo)" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={styles.inputSmall} type="number" step="0.01" placeholder="Bundle price (Rs.)" value={price} onChange={(e) => setPrice(e.target.value)} />
        <button type="submit" style={styles.button}>Add</button>
      </form>
    </div>
  );
}

export default DealForm;
