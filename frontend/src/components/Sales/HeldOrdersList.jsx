import { Panel, Badge, Button } from '../ui';
import { formatMoney } from '../../lib/money';
import styles from './HeldOrdersList.module.css';

// The held rail answers one question — "what did we park that nobody has paid for yet" — so each
// row carries only what is needed to recognise the order out loud: the ticket, what is in it, and
// what it comes to. There is no print badge and no ticket preview here: a held order has never
// been near a printer, and offering "view ticket" for one would suggest otherwise.
//
// The lines are summarised rather than listed. A held cart is frequently four or five items, and
// a rail this narrow showing every one of them would push the Recall button off the row that
// matters — the name is there to jog the operator's memory, and the cart itself is one click away.
function summarise(items) {
  const lines = Array.isArray(items) ? items : [];
  const names = lines
    .map((item) => item.menu_item_name)
    .filter(Boolean);

  if (names.length === 0) return 'No items';

  const quantity = lines.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  return `${quantity} item${quantity === 1 ? '' : 's'} · ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}`;
}

function HeldOrdersList({ orders, onRecall, onDiscard, discardingId }) {
  function confirmDiscard(order) {
    // Deleting is the only irreversible thing on this screen, so it asks — and the question says
    // what is lost, because "discard" alone does not tell anyone that the cart is gone for good.
    if (!window.confirm(`Discard ${order.ticket_number}? The cart is deleted and cannot be recovered.`)) return;
    onDiscard(order.id);
  }

  return (
    <Panel title="Held orders" flush className={styles.panel}>
      <div className={styles.list}>
        {orders.length === 0 ? (
          <p className={styles.empty}>Nothing on hold.</p>
        ) : (
          orders.map((order) => (
            <div key={order.id} className={styles.order}>
              <div className={styles.orderTop}>
                <div className={styles.ticket}>
                  {order.ticket_number}
                  <Badge tone="warn">On hold</Badge>
                </div>
                <span className={styles.total}>{formatMoney(order.total_amount_cents)}</span>
              </div>

              <div className={styles.meta}>{summarise(order.items)}</div>

              <div className={styles.actions}>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onRecall(order)}
                >
                  Recall
                </Button>

                <Button
                  size="sm"
                  variant="dangerGhost"
                  disabled={discardingId === order.id}
                  onClick={() => confirmDiscard(order)}
                >
                  {discardingId === order.id ? 'Discarding…' : 'Discard'}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

export default HeldOrdersList;
