import { useState, useEffect } from 'react';
import { dealsApi } from '../../api/client';
import { Button, Input, Select } from '../ui';
import { formatMoney } from '../../lib/money';
import styles from './DealItemsManager.module.css';

function DealItemsManager({ dealId, menuItems }) {
  const [items, setItems] = useState([]);
  const [menuItemId, setMenuItemId] = useState(menuItems[0]?.id ?? '');
  const [qty, setQty] = useState('1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const deal = await dealsApi.getById(dealId);
      setItems(deal.items);
      setError(null);
    } catch (err) {
      // Same trap as RecipeManager: a rejected fetch used to leave this stuck on
      // "Loading…" forever because setLoading(false) was never reached.
      setError('Could not load deal items. ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [dealId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!menuItemId || !qty) return;
    try {
      await dealsApi.addItem(dealId, Number(menuItemId), Number(qty));
      setQty('1');
      await load();
    } catch (err) {
      setError('Could not add item to deal. ' + err.message);
    }
  }

  // What the components would cost if bought separately. Shown so whoever builds the
  // deal can see the discount they're actually giving away.
  const normalTotal = items.reduce((sum, i) => sum + i.normal_price_cents * i.quantity, 0);

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.empty}>Loading…</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {error && <p className={styles.error}>{error}</p>}

      {items.length === 0 && !error && (
        <p className={styles.empty}>No items in this deal yet — add the components below.</p>
      )}

      {items.length > 0 && (
        <div className={styles.list}>
          {items.map((i) => (
            <div key={i.menu_item_id} className={styles.row}>
              <span className={styles.qty}>{i.quantity}×</span>
              <span>{i.menu_item_name}</span>
            </div>
          ))}
          <p className={styles.note}>Bought separately: {formatMoney(normalTotal)}</p>
        </div>
      )}

      <form className={styles.addRow} onSubmit={handleAdd}>
        <Select
          aria-label="Menu item"
          className={styles.select}
          value={menuItemId}
          onChange={(e) => setMenuItemId(e.target.value)}
          disabled={menuItems.length === 0}
        >
          {menuItems.length === 0 && <option value="">No menu items yet</option>}
          {menuItems.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>

        <Input
          aria-label="Quantity in this deal"
          className={styles.count}
          type="number" min="1" step="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />

        <Button type="submit" variant="secondary" size="sm" disabled={menuItems.length === 0}>
          Add to deal
        </Button>
      </form>
    </div>
  );
}

export default DealItemsManager;
