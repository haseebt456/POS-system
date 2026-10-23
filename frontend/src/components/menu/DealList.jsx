import { useState } from 'react';
import DealItemsManager from './DealItemsManager';
import { Panel } from '../ui';
import { formatMoney } from '../../lib/money';
import styles from './DealList.module.css';

function DealList({ deals, menuItems }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <Panel title="Deals" tone="deal" flush>
      {deals.length === 0 ? (
        <p className={styles.empty}>No deals yet.</p>
      ) : (
        deals.map((deal) => {
          const expanded = expandedId === deal.id;

          return (
            <div key={deal.id} className={styles.item}>
              <button
                type="button"
                className={styles.row}
                aria-expanded={expanded}
                onClick={() => setExpandedId(expanded ? null : deal.id)}
              >
                <span className={styles.main}>
                  <span className={styles.name}>{deal.name}</span>
                </span>
                <span className={styles.price}>{formatMoney(deal.price_cents)}</span>
                <span className={styles.caret} aria-hidden="true">{expanded ? '▾' : '▸'}</span>
              </button>

              {expanded && <DealItemsManager dealId={deal.id} menuItems={menuItems} />}
            </div>
          );
        })
      )}
    </Panel>
  );
}

export default DealList;
