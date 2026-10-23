import { useState } from 'react';
import { ordersApi } from '../../api/client';
import { Panel, Badge, Button } from '../ui';
import { formatMoney } from '../../lib/money';
import styles from './PendingOrdersList.module.css';

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
  printed: { tone: 'ok', label: 'Printed' },
  failed: { tone: 'danger', label: 'Print failed' },
  pending: { tone: 'warn', label: 'Not printed' },
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
      setPreviewError('Could not load ticket preview. ' + err.message);
    }
  }

  return (
    <Panel title="Pending orders" flush className={styles.panel}>
      {previewError && <p className={styles.error}>{previewError}</p>}

      <div className={styles.list}>
        {orders.length === 0 ? (
          <p className={styles.empty}>No pending orders right now.</p>
        ) : (
          orders.map((order) => {
            const badge = BADGE[derivePrintState(order)];
            const preview = previews[order.id];
            const items = order.items?.length ?? 0;

            return (
              <div key={order.id} className={styles.order}>
                <div className={styles.orderTop}>
                  <div>
                    <div className={styles.ticket}>
                      {order.ticket_number}
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </div>
                    <div className={styles.meta}>
                      {order.order_type} · {items} item{items === 1 ? '' : 's'}
                    </div>
                  </div>
                  <span className={styles.total}>{formatMoney(order.total_amount_cents)}</span>
                </div>

                <div className={styles.actions}>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={completingId === order.id}
                    onClick={() => onComplete(order.id)}
                  >
                    {completingId === order.id ? 'Completing…' : 'Mark complete'}
                  </Button>

                  {badge !== BADGE.printed && (
                    <Button
                      size="sm"
                      variant="dangerGhost"
                      disabled={retryingId === order.id}
                      onClick={() => onRetryPrint(order.id, order.ticket_number)}
                    >
                      {retryingId === order.id ? 'Printing…' : 'Retry printing'}
                    </Button>
                  )}

                  <Button size="sm" variant="ghost" onClick={() => togglePreview(order.id)}>
                    {openPreviewId === order.id ? 'Hide ticket' : 'View ticket'}
                  </Button>
                </div>

                {openPreviewId === order.id && (
                  <div>
                    {!preview ? (
                      <p className={styles.previewLabel}>Loading…</p>
                    ) : (
                      <>
                        {preview.kitchen.map((ticket) => (
                          <div key={ticket.station_id}>
                            <p className={styles.previewLabel}>
                              {ticket.station_name}
                              {ticket.transport === 'dry-run' && ' · simulated (no printer configured)'}
                            </p>
                            <pre className={styles.preview}>{ticket.text}</pre>
                          </div>
                        ))}

                        <p className={styles.previewLabel}>
                          {preview.receipt.station_name ?? 'No receipt printer configured'}
                        </p>
                        <pre className={styles.preview}>{preview.receipt.text}</pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}

export default PendingOrdersList;
