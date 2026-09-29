import { useState, useEffect } from 'react';
import { dealsApi } from '../../api/client';

const styles = {
  wrap: { background: '#fafbfc', borderTop: '1px solid #f0f1f3', padding: '12px 16px' },
  row: { fontSize: 13, padding: '6px 0' },
  addRow: { display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' },
  select: { flex: '1 1 160px', padding: '7px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, color: '#22262b' },
  input: { flex: '0 1 90px', padding: '7px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, color: '#22262b' },
  button: { padding: '7px 14px', fontSize: 13, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' },
  empty: { fontSize: 13, color: '#9ca3af' },
  note: { fontSize: 12, color: '#9a6b00', marginTop: 8 },
};

function DealItemsManager({ dealId, menuItems }) {
  const [items, setItems] = useState([]);
  const [menuItemId, setMenuItemId] = useState(menuItems[0]?.id ?? '');
  const [qty, setQty] = useState('1');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const deal = await dealsApi.getById(dealId);
    setItems(deal.items);
    setLoading(false);
  }

  useEffect(() => { load(); }, [dealId]);

  async function handleAdd() {
    if (!menuItemId || !qty) return;
    await dealsApi.addItem(dealId, Number(menuItemId), Number(qty));
    setQty('1');
    await load();
  }

  const normalTotal = items.reduce((sum, i) => sum + i.normal_price_cents * i.quantity, 0);

  if (loading) return <div style={styles.wrap}><span style={styles.empty}>Loading…</span></div>;

  return (
    <div style={styles.wrap}>
      {items.length === 0 ? (
        <div style={styles.empty}>No items in this deal yet — add the components below.</div>
      ) : (
        <>
          {items.map((i) => (
            <div key={i.menu_item_id} style={styles.row}>{i.quantity}× {i.menu_item_name}</div>
          ))}
          <div style={styles.note}>Normal price for these items: Rs. {(normalTotal / 100).toFixed(0)}</div>
        </>
      )}
      <div style={styles.addRow}>
        <select style={styles.select} value={menuItemId} onChange={(e) => setMenuItemId(e.target.value)}>
          {menuItems.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <input style={styles.input} type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        <button style={styles.button} onClick={handleAdd}>Add to deal</button>
      </div>
    </div>
  );
}

export default DealItemsManager;
