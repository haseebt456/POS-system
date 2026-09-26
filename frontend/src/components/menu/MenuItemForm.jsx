import { useState } from 'react';

const styles = {
  panel: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', marginBottom: 20 },
  heading: { fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 },
  form: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  input: { flex: '1 1 180px', padding: '10px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#22262b', background: '#fafafa' },
  inputSmall: { flex: '0 1 130px', padding: '10px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#22262b', background: '#fafafa' },
  button: { padding: '10px 18px', fontSize: 14, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' },
};

function MenuItemForm({ stations, onCreate }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [stationId, setStationId] = useState(stations[0]?.id ?? '');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !price || !stationId) return;
    await onCreate({
      name: name.trim(),
      category: category.trim(),
      price_cents: Math.round(Number(price) * 100),
      station_id: Number(stationId),
    });
    setName(''); setCategory(''); setPrice('');
  }

  return (
    <div style={styles.panel}>
      <div style={styles.heading}>Add menu item</div>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input style={styles.input} placeholder="Name (e.g. Cheeseburger)" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={styles.inputSmall} placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        <input style={styles.inputSmall} type="number" step="0.01" placeholder="Price (Rs.)" value={price} onChange={(e) => setPrice(e.target.value)} />
        <select style={styles.inputSmall} value={stationId} onChange={(e) => setStationId(e.target.value)}>
          {stations.length === 0 && <option value="">No stations yet</option>}
          {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="submit" style={styles.button}>Add</button>
      </form>
    </div>
  );
}

export default MenuItemForm;
