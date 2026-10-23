import { useState } from 'react';
import RecipeManager from './RecipeManager';
import { Badge, Button, Panel } from '../ui';
import { formatMoney } from '../../lib/money';
import { uploadUrl } from '../../api/client';
import styles from './MenuItemList.module.css';

function MenuItemList({ menuItems, ingredients, stations, onEdit, onDeactivate }) {
  const [expandedId, setExpandedId] = useState(null);

  const stationName = (id) => stations.find((s) => s.id === id)?.name ?? 'Category printer';

  return (
    <Panel title="Menu items" flush>
      {menuItems.length === 0 ? (
        <p className={styles.empty}>No menu items yet.</p>
      ) : (
        menuItems.map((item) => {
          const expanded = expandedId === item.id;
          const src = uploadUrl(item.image_path);

          return (
            <div key={item.id} className={styles.item}>
              <div className={styles.rowWrap}>
                <button
                  type="button"
                  className={styles.row}
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                >
                  {src ? (
                    <img className={styles.thumb} src={src} alt="" />
                  ) : (
                    <span className={styles.thumbPlaceholder} aria-hidden="true" />
                  )}
                  <span className={styles.main}>
                    <span className={styles.name}>
                      {item.name}
                      {item.is_available === 0 && <Badge tone="warn">Sold out</Badge>}
                    </span>
                    <span className={styles.meta}>
                      {item.category || 'Uncategorised'} · {stationName(item.station_id)}
                    </span>
                  </span>
                  <span className={styles.price}>{formatMoney(item.price_cents)}</span>
                  <span className={styles.caret} aria-hidden="true">{expanded ? '▾' : '▸'}</span>
                </button>
                <div className={styles.rowActions}>
                  <Button size="sm" variant="ghost" onClick={() => onEdit(item)}>Edit</Button>
                  <Button
                    size="sm"
                    variant="dangerGhost"
                    onClick={() => onDeactivate(item.id, item.name)}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              {expanded && <RecipeManager menuItemId={item.id} ingredients={ingredients} />}
            </div>
          );
        })
      )}
    </Panel>
  );
}

export default MenuItemList;
