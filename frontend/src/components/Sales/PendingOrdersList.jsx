import { formatPrice } from './MenuGrid';

const styles = {
  panel: {
    background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12,
    padding: '16px 18px', boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
  },
  title: { fontSize: 15, fontWeight: 700, marginBottom: 12 },
  empty: { fontSize: 14, color: '#9ca3af' },
  order: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 0', borderBottom: '1px solid #f0f1f3',
  },
  ticketNumber: { fontSize: 14, fontWeight: 700, color: '#22262b' },
  orderMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  total: { fontSize: 14, fontWeight: 600, marginRight: 16 },
  completeButton: {
    padding: '8px 14px', fontSize: 13, fontWeight: 600, background: '#2563eb',
    color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
  },
  completeButtonDisabled: { background: '#a8c5f5', cursor: 'not-allowed' },
};

function PendingOrdersList({ orders, onComplete, completingId }) {
  return (
    <div style={styles.panel}>
      <div style={styles.title}>Pending Orders</div>
      {orders.length === 0 ? (
        <p style={styles.empty}>No pending orders right now.</p>
      ) : (
        orders.map((order) => (
          <div key={order.id} style={styles.order}>
            <div>
              <div style={styles.ticketNumber}>{order.ticket_number}</div>
              <div style={styles.orderMeta}>{order.order_type} · {order.items?.length ?? 0} items</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={styles.total}>{formatPrice(order.total_amount_cents)}</span>
              <button
                style={{ ...styles.completeButton, ...(completingId === order.id ? styles.completeButtonDisabled : {}) }}
                disabled={completingId === order.id}
                onClick={() => onComplete(order.id)}
              >
                {completingId === order.id ? 'Completing…' : 'Mark Complete'}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default PendingOrdersList;
