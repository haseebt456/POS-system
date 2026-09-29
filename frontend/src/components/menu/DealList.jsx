import { useState } from 'react';
import DealItemsManager from './DealItemsManager';

const styles = {
  panel: { background: '#fff', border: '1px solid #fbbf24', borderRadius: 12, overflow: 'hidden', background: '#fffbeb' },
  heading: { fontSize: 13, fontWeight: 600, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '14px 20px 0' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: '1px solid #fde68a', cursor: 'pointer' },
  name: { fontSize: 15, fontWeight: 600 },
  price: { fontSize: 14, fontWeight: 600, color: '#2563eb' },
  empty: { fontSize: 14, color: '#9ca3af', padding: '16px 20px' },
};

function DealList({ deals, menuItems }) {
  const [expandedId, setExpandedId] = useState(null);

  if (deals.length === 0) {
    return <div style={styles.panel}><p style={styles.empty}>No deals yet.</p></div>;
  }

  return (
    <div style={styles.panel}>
      <div style={styles.heading}>Deals</div>
      {deals.map((deal) => (
        <div key={deal.id}>
          <div style={styles.row} onClick={() => setExpandedId(expandedId === deal.id ? null : deal.id)}>
            <div style={styles.name}>{deal.name}</div>
            <div style={styles.price}>Rs. {(deal.price_cents / 100).toFixed(0)}</div>
          </div>
          {expandedId === deal.id && <DealItemsManager dealId={deal.id} menuItems={menuItems} />}
        </div>
      ))}
    </div>
  );
}

export default DealList;
