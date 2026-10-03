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
  const [retryingId, setRetryingId] = useState(null);
  const [printWarning, setPrintWarning] = useState(null);

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

  // Printing is deliberately a separate step from saving the order. The order is
  // already committed by the time this runs, so a printer being offline can never
  // lose a sale — it surfaces as a retryable warning instead.
  async function attemptPrint(orderId, ticketNumber) {
    try {
      const result = await ordersApi.print(orderId);

      const failures = result.stations
        .filter((s) => !s.ok)
        .map((s) => ({ name: s.station_name, error: s.error }));

      // A receipt station that simply doesn't exist yet isn't a failure — it would
      // otherwise flag every single order before the hardware is installed.
      if (result.receipt && !result.receipt.ok && result.receipt.configured !== false) {
        failures.push({ name: result.receipt.station_name ?? 'Receipt printer', error: result.receipt.error });
      }

      setPrintWarning(failures.length > 0 ? { orderId, ticketNumber, failures } : null);
    } catch (err) {
      setPrintWarning({
        orderId,
        ticketNumber,
        failures: [{ name: 'Printing', error: err.message }],
      });
    }
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
      const { orderId, ticket_number } = await ordersApi.create({ order_type: 'takeaway', created_by: CURRENT_USER_ID, lines });
      setCartLines([]);
      await loadCatalog(); // refresh pending list to include the new order
      await attemptPrint(orderId, ticket_number);
      await loadCatalog(); // pick up the print statuses we just recorded
    } catch (err) {
      setError('Could not submit order. ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Retries only what didn't print. The backend skips anything already printed, so
  // tapping this twice can't send duplicate tickets to a printer that worked.
  async function handleRetryPrint(orderId, ticketNumber) {
    setRetryingId(orderId);
    setError(null);
    try {
      await attemptPrint(orderId, ticketNumber);
      await loadCatalog();
    } finally {
      setRetryingId(null);
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

        {printWarning && (
          <div style={{ background: '#fdecea', color: '#a32b1f', padding: '12px 16px', borderRadius: 8, fontSize: 14, border: '1px solid #f3c8c2' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              {printWarning.ticketNumber} did not print
            </div>
            {printWarning.failures.map((f, i) => (
              <div key={i} style={{ fontSize: 13 }}>• {f.name}: {f.error}</div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, background: '#a32b1f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                onClick={() => handleRetryPrint(printWarning.orderId, printWarning.ticketNumber)}
              >
                Retry printing
              </button>
              <button
                style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, background: 'none', color: '#a32b1f', border: 'none', cursor: 'pointer' }}
                onClick={() => setPrintWarning(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <PendingOrdersList
          orders={pendingOrders}
          onComplete={handleCompleteOrder}
          completingId={completingId}
          onRetryPrint={handleRetryPrint}
          retryingId={retryingId}
        />
      </div>
    </div>
  );
}

export default SalesScreen;
