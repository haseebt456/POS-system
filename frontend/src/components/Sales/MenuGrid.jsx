const styles = {
  sectionTitle: { fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '18px 0 10px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 },
  card: {
    background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12,
    padding: '16px 14px', cursor: 'pointer', textAlign: 'left',
    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)', transition: 'border-color 0.1s',
  },
  cardDeal: { borderColor: '#fbbf24', background: '#fffbeb' },
  cardName: { fontSize: 15, fontWeight: 600, color: '#22262b', marginBottom: 4 },
  cardPrice: { fontSize: 14, color: '#2563eb', fontWeight: 600 },
  dealBadge: {
    fontSize: 10, fontWeight: 700, color: '#92400e', background: '#fde68a',
    padding: '2px 6px', borderRadius: 4, marginBottom: 6, display: 'inline-block',
    textTransform: 'uppercase', letterSpacing: '0.03em',
  },
  empty: { fontSize: 14, color: '#9ca3af', gridColumn: '1 / -1' },
};

function formatPrice(cents) {
  return `Rs. ${(cents / 100).toFixed(0)}`;
}

function MenuGrid({ menuItems, deals, onAddMenuItem, onAddDeal }) {
  return (
    <div>
      <div style={styles.sectionTitle}>Deals</div>
      <div style={styles.grid}>
        {deals.length === 0 && <span style={styles.empty}>No deals yet.</span>}
        {deals.map((deal) => (
          <button key={deal.id} style={{ ...styles.card, ...styles.cardDeal }} onClick={() => onAddDeal(deal)}>
            <span style={styles.dealBadge}>Deal</span>
            <div style={styles.cardName}>{deal.name}</div>
            <div style={styles.cardPrice}>{formatPrice(deal.price_cents)}</div>
          </button>
        ))}
      </div>

      <div style={styles.sectionTitle}>Menu Items</div>
      <div style={styles.grid}>
        {menuItems.length === 0 && <span style={styles.empty}>No menu items yet.</span>}
        {menuItems.map((item) => (
          <button key={item.id} style={styles.card} onClick={() => onAddMenuItem(item)}>
            <div style={styles.cardName}>{item.name}</div>
            <div style={styles.cardPrice}>{formatPrice(item.price_cents)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default MenuGrid;
export { formatPrice };
