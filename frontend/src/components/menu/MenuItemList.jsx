import { useState } from 'react';
import RecipeManager from './RecipeManager';

const styles = {
  panel: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 24 },
  heading: { fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '14px 20px 0' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: '1px solid #f0f1f3', cursor: 'pointer' },
  name: { fontSize: 15, fontWeight: 600 },
  meta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  price: { fontSize: 14, fontWeight: 600, color: '#2563eb' },
  empty: { fontSize: 14, color: '#9ca3af', padding: '16px 20px' },
};

function MenuItemList({ menuItems, ingredients, stations }) {
  const [expandedId, setExpandedId] = useState(null);

  const stationName = (id) => stations.find((s) => s.id === id)?.name ?? '—';

  if (menuItems.length === 0) {
    return <div style={styles.panel}><p style={styles.empty}>No menu items yet.</p></div>;
  }

  return (
    <div style={styles.panel}>
      <div style={styles.heading}>Menu Items</div>
      {menuItems.map((item) => (
        <div key={item.id}>
          <div style={styles.row} onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
            <div>
              <div style={styles.name}>{item.name}</div>
              <div style={styles.meta}>{item.category || 'No category'} · {stationName(item.station_id)}</div>
            </div>
            <div style={styles.price}>Rs. {(item.price_cents / 100).toFixed(0)}</div>
          </div>
          {expandedId === item.id && <RecipeManager menuItemId={item.id} ingredients={ingredients} />}
        </div>
      ))}
    </div>
  );
}

export default MenuItemList;
