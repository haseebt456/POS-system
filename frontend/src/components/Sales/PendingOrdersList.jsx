import { useState } from 'react';
import { ordersApi } from '../../api/client';
import { formatPrice } from './MenuGrid';

const styles = {
  panel: {
    background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12,
    padding: '16px 18px', boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
  },
  title: { fontSize: 15, fontWeight: 700, marginBottom: 12 },
  empty: { fontSize: 14, color: '#9ca3af' },
  order: { padding: '12px 0', borderBottom: '1px solid #f0f1f3' },
  orderTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  ticketNumber: { fontSize: 14, fontWeight: 700, color: '#22262b' },
  orderMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  total: { fontSize: 14, fontWeight: 600, marginRight: 16 },
  buttonRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  completeButton: {
    padding: '8px 14px', fontSize: 13, fontWeight: 600, background: '#2563eb',
    color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
  },
  completeButtonDisabled: { background: '#a8c5f5', cursor: 'not-allowed' },
  linkButton: { background: 'none', border: 'none', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 8px' },
  retryButton: { background: 'none', border: 'none', color: '#a32b1f', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '6px 8px' },
  badge: { fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, marginLeft: 8 },
  badgePrinted: { color: '#15803d', background: '#dcfce7' },
  badgeFailed: { color: '#a32b1f', background: '#fdecea' },
  badgePending: { color: '#9a6b00', background: '#fef3c7' },
  preview: {
    background: '#22262b', color: '#e5e7eb', fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: 12, lineHeight: 1.35, padding: '12px 14px', borderRadius: 8, marginTop: 10,
    whiteSpace: 'pre', overflowX: 'auto',
  },
  previewLabel: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 10 },
};

// Kitchen items drive the badge. The receipt is reported separately and only when it
// actually failed — otherwise every order would show "receipt not printed" until a
// receipt printer exists, which would drown out the failures that matter.
function derivePrintState(order) {
  // The filter matters: a render error here takes down the entire Sales screen, and a
  // blank till mid-service is far worse than a wrong badge. Anything that isn't an
  // object is dropped rather than dereferenced.
  const statuses = (Array.isArray(order.items) ? order.items : [])
    .filter((i) => i && typeof i === 'object')
    .map((i) => i.print_status);
  const anyFailed = statuses.includes('failed') || order.receipt_print_status === 'failed';
  if (anyFailed) return 'failed';
  if (statuses.length > 0 && statuses.every((s) => s === 'printed')) return 'printed';
  return 'pending';
}

const BADGE = {
  printed: { style: styles.badgePrinted, label: 'Printed' },
  failed: { style: styles.badgeFailed, label: 'Print failed' },
  pending: { style: styles.badgePending, label: 'Not printed' },
};

function PendingOrdersList({ orders, onComplete, completingId, onRetryPrint, retryingId }) {
  const [openPreviewId, setOpenPreviewId] = useState(null);
  const [previews, setPreviews] = useState({});
  const [previewError, setPreviewError] = useState(null);

  async function togglePreview(orderId) {
    if (openPreviewId === orderId) {
      setOpenPreviewId(null);
      return;
    }
    setPreviewError(null);
    setOpenPreviewId(orderId);
    if (previews[orderId]) return;

    try {
      const result = await ordersApi.preview(orderId);
      setPreviews((prev) => ({ ...prev, [orderId]: result }));
    } catch (err) {
      setPreviewError('Could not load ticket preview: ' + err.message);
    }
  }

  return (
    <div style={styles.panel}>
      <div style={styles.title}>Pending Orders</div>

      {previewError && (
        <div style={{ fontSize: 13, color: '#a32b1f', marginBottom: 10 }}>{previewError}</div>
      )}

      {orders.length === 0 ? (
        <p style={styles.empty}>No pending orders right now.</p>
      ) : (
        orders.map((order) => {
          const printState = derivePrintState(order);
          const badge = BADGE[printState];
          const preview = previews[order.id];

          return (
            <div key={order.id} style={styles.order}>
              <div style={styles.orderTop}>
                <div>
                  <div style={styles.ticketNumber}>
                    {order.ticket_number}
                    <span style={{ ...styles.badge, ...badge.style }}>{badge.label}</span>
                  </div>
                  <div style={styles.orderMeta}>
                    {order.order_type} · {order.items?.length ?? 0} items
                  </div>
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

              <div style={styles.buttonRow}>
                {printState !== 'printed' && (
                  <button
                    style={styles.retryButton}
                    disabled={retryingId === order.id}
                    onClick={() => onRetryPrint(order.id, order.ticket_number)}
                  >
                    {retryingId === order.id ? 'Printing…' : 'Retry printing'}
                  </button>
                )}
                <button style={styles.linkButton} onClick={() => togglePreview(order.id)}>
                  {openPreviewId === order.id ? 'Hide ticket' : 'View ticket'}
                </button>
              </div>

              {openPreviewId === order.id && (
                <div>
                  {!preview ? (
                    <div style={styles.previewLabel}>Loading…</div>
                  ) : (
                    <>
                      {preview.kitchen.map((ticket) => (
                        <div key={ticket.station_id}>
                          <div style={styles.previewLabel}>
                            {ticket.station_name}
                            {ticket.transport === 'dry-run' && ' · simulated (no printer configured)'}
                          </div>
                          <pre style={styles.preview}>{ticket.text}</pre>
                        </div>
                      ))}
                      <div style={styles.previewLabel}>
                        {preview.receipt.station_name ?? 'No receipt printer configured'}
                      </div>
                      <pre style={styles.preview}>{preview.receipt.text}</pre>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default PendingOrdersList;
