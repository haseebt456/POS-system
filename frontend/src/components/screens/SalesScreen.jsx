import { useState, useEffect } from 'react';
import { menuItemsApi, dealsApi, ordersApi } from '../../api/client';
import MenuGrid from '../Sales/MenuGrid';
import Cart from '../Sales/Cart';
import PendingOrdersList from '../Sales/PendingOrdersList';

// TEMPORARY: no login/auth built yet — hardcoded until models/user.js and a real
// login screen exist. A users row with this id must exist in the database.
const CURRENT_USER_ID = 1;

function SalesScreen() {
  const [menuItems, setMenuItems] = useState([]);
  const [deals, setDeals] = useState([]);
  const [cartLines, setCartLines] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [completingId, setCompletingId] = useState(null);

  async function loadCatalog() {
    setLoading(true);
    setError(null);
    try {
      const [items, dealList, pending] = await Promise.all([
        menuItemsApi.getAll(),
        dealsApi.getAll(),
        ordersApi.getPending(),
      ]);
      setMenuItems(items);
      setDeals(dealList);
      setPendingOrders(pending);
    } catch (err) {
      setError('Could not load sales data. ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCatalog(); }, []);

  function addMenuItemToCart(item) {
    setCartLines((lines) => {
      const key = `menu_item:${item.id}`;
      const existing = lines.find((l) => l.key === key);
      if (existing) {
        return lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...lines, {
        key,
        type: 'menu_item',
        menuItemId: item.id,
        stationId: item.station_id,
        name: item.name,
        unitPriceCents: item.price_cents,
        quantity: 1,
      }];
    });
  }

  function addDealToCart(deal) {
    setCartLines((lines) => {
      const key = `deal:${deal.id}`;
      const existing = lines.find((l) => l.key === key);
      if (existing) {
        return lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...lines, {
        key,
        type: 'deal',
        dealId: deal.id,
        name: deal.name,
        unitPriceCents: deal.price_cents,
        quantity: 1,
      }];
    });
  }

  function changeQty(key, newQty) {
    if (newQty <= 0) {
      setCartLines((lines) => lines.filter((l) => l.key !== key));
      return;
    }
    setCartLines((lines) => lines.map((l) => (l.key === key ? { ...l, quantity: newQty } : l)));
  }

  function removeLine(key) {
    setCartLines((lines) => lines.filter((l) => l.key !== key));
  }

  async function handleSubmitOrder() {
    setSubmitting(true);
    setError(null);
    try {
      const lines = cartLines.map((l) =>
        l.type === 'deal'
          ? { type: 'deal', deal_id: l.dealId, quantity: l.quantity }
          : { type: 'menu_item', menu_item_id: l.menuItemId, station_id: l.stationId, quantity: l.quantity, unit_price_cents: l.unitPriceCents }
      );
      await ordersApi.create({ order_type: 'takeaway', created_by: CURRENT_USER_ID, lines });
      setCartLines([]);
      await loadCatalog(); // refresh pending list to include the new order
    } catch (err) {
      setError('Could not submit order. ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteOrder(orderId) {
    setCompletingId(orderId);
    setError(null);
    try {
      await ordersApi.complete(orderId);
      await loadCatalog();
    } catch (err) {
      setError('Could not complete order. ' + err.message);
    } finally {
      setCompletingId(null);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div style={{ padding: '24px 20px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 16px' }}>Sales</h1>
        {error && (
          <div style={{ background: '#fdecea', color: '#a32b1f', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, border: '1px solid #f3c8c2' }}>
            {error}
          </div>
        )}
        <MenuGrid menuItems={menuItems} deals={deals} onAddMenuItem={addMenuItemToCart} onAddDeal={addDealToCart} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Cart lines={cartLines} onChangeQty={changeQty} onRemove={removeLine} onSubmit={handleSubmitOrder} submitting={submitting} />
        <PendingOrdersList orders={pendingOrders} onComplete={handleCompleteOrder} completingId={completingId} />
      </div>
    </div>
  );
}

export default SalesScreen;
