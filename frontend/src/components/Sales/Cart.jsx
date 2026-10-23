import { Panel, Badge, Button } from '../ui';
import { cx } from '../../lib/cx';
import { formatMoney } from '../../lib/money';
import styles from './Cart.module.css';

// `totalCents` is passed in rather than summed here: the payment panel counts the customer's
// money against the same number, and two reductions over the same array is two chances for the
// cart and the payment step to disagree about what is owed.
//
// `resumingTicket` is the held order this cart came out of, if any. It is shown rather than
// silently tracked because the difference matters at the counter: paying here rewrites that
// order, and the operator should be able to see which one they are holding.
function Cart({ lines, totalCents, onChangeQty, onSubmit, onHold, holding, submitting, resumingTicket, onNewOrder }) {
  const empty = lines.length === 0;

  return (
    <Panel title="Current order" flush className={styles.panel}>
      {resumingTicket && (
        <div className={styles.recall}>
          <span className={styles.recallText}>
            Recalling <strong>{resumingTicket}</strong>
          </span>
          <Button size="sm" variant="ghost" onClick={onNewOrder}>
            Start new order
          </Button>
        </div>
      )}

      {empty ? (
        <p className={styles.empty}>Tap a menu item or deal to add it here.</p>
      ) : (
        <div className={styles.lines}>
          {lines.map((line) => {
            const lastOne = line.quantity === 1;

            return (
              <div key={line.key} className={styles.line}>
                <div className={styles.lineMain}>
                  <span className={styles.lineName} title={line.name}>{line.name}</span>
                  {line.type === 'deal' && <Badge tone="deal" shape="square">Deal</Badge>}
                </div>

                <div className={styles.controls}>
                  {/* At one, this removes the line rather than stepping to zero — the
                      usual till gesture. The label says so instead of hiding behind a
                      "−", which would be meaningless read aloud. */}
                  <Button
                    size="icon"
                    variant="secondary"
                    aria-label={lastOne ? `Remove ${line.name}` : `Decrease quantity of ${line.name}`}
                    title={lastOne ? 'Remove' : 'Decrease'}
                    onClick={() => onChangeQty(line.key, line.quantity - 1)}
                  >
                    −
                  </Button>
                  <span className={styles.qtyValue}>{line.quantity}</span>
                  <Button
                    size="icon"
                    variant="secondary"
                    aria-label={`Increase quantity of ${line.name}`}
                    title="Increase"
                    onClick={() => onChangeQty(line.key, line.quantity + 1)}
                  >
                    +
                  </Button>
                </div>

                <span className={styles.lineTotal}>
                  {formatMoney(line.quantity * line.unitPriceCents)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.footer}>
        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>Total</span>
          <span className={styles.totalValue}>{formatMoney(totalCents)}</span>
        </div>

        <Button
          size="lg"
          variant="success"
          className={cx(styles.submit)}
          disabled={empty || submitting || holding}
          onClick={onSubmit}
        >
          {submitting ? 'Saving…' : 'Take payment'}
        </Button>

        {/* Holding is the second way out of a full cart, and the quieter one — the customer is
            not being served yet, so it sits below Take payment at secondary weight rather than
            competing with it. */}
        <Button
          className={styles.hold}
          variant="secondary"
          disabled={empty || holding || submitting}
          onClick={onHold}
        >
          {holding ? 'Holding…' : 'Hold order'}
        </Button>
      </div>
    </Panel>
  );
}

export default Cart;
