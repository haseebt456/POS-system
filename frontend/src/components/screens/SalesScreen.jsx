import { useState, useEffect } from 'react';
import { menuItemsApi, dealsApi, ordersApi, paymentMethodsApi, posConfigApi } from '../../api/client';
import MenuGrid from '../Sales/MenuGrid';
import Cart from '../Sales/Cart';
import PaymentPanel from '../Sales/PaymentPanel';
import PendingOrdersList from '../Sales/PendingOrdersList';
import HeldOrdersList from '../Sales/HeldOrdersList';
import { Banner, Button, PageHeader } from '../ui';
import styles from './SalesScreen.module.css';

// Rebuilds a cart from a held order's stored lines.
//
// The lines coming back are NOT the cart that produced them: a deal was expanded into its real
// components when it was rung up, so it returns as several rows carrying the deal's id and the
// multiplier it was sold at, with the whole of the money on the first of them. Rebuilding means
// collapsing each of those groups back into one line — and `deal_quantity` is exactly the cart
// quantity, which is why it is stored on every component row.
//
// The deal's price is read from the live deal list rather than divided out of the stored total:
// the server re-prices a deal from the deals table when the order is saved, so taking the price
// from the same place is what makes the cart and the receipt agree. The division is the fallback
// for a deal that is no longer on the menu — a held order for one will fail to save anyway, with
// "Deal N not found", which is a better error than a silently wrong total.
function cartLinesFrom(orderItems, deals) {
  const priceOf = new Map(deals.map((deal) => [deal.id, deal.price_cents]));
  const lines = [];
  const dealsSeen = new Set();

  for (const item of orderItems) {
    if (item.deal_id) {
      if (dealsSeen.has(item.deal_id)) continue;
      dealsSeen.add(item.deal_id);

      const quantity = item.deal_quantity ?? 1;
      const stored = quantity > 0 ? Math.round((item.line_total_cents ?? 0) / quantity) : 0;
      lines.push({
        key: `deal:${item.deal_id}`,
        type: 'deal',
        dealId: item.deal_id,
        name: item.deal_name ?? `Deal #${item.deal_id}`,
        unitPriceCents: priceOf.get(item.deal_id) ?? stored,
        quantity,
      });
      continue;
    }

    lines.push({
      key: `menu_item:${item.menu_item_id}`,
      type: 'menu_item',
      menuItemId: item.menu_item_id,
      stationId: item.station_id,
      name: item.menu_item_name ?? 'Item',
      unitPriceCents: item.unit_price_cents,
      quantity: item.quantity,
    });
  }

  return lines;
}

function SalesScreen() {
  const [menuItems, setMenuItems] = useState([]);
  const [deals, setDeals] = useState([]);
  const [cartLines, setCartLines] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [heldOrders, setHeldOrders] = useState([]);
  // The held order the cart was recalled from, or null when this is a new sale. Paying while it
  // is set rewrites that order instead of creating a second one.
  const [resumingId, setResumingId] = useState(null);
  const [holding, setHolding] = useState(false);
  const [discardingId, setDiscardingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [printWarning, setPrintWarning] = useState(null);

  // Payment happens in a slide-over once the cart is filled. `payError` is separate from
  // `error` because it belongs inside that panel: a refusal from the discount cap shown on the
  // page behind a modal panel is a message the operator cannot see and cannot act on.
  const [methods, setMethods] = useState([]);
  const [posConfig, setPosConfig] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payError, setPayError] = useState(null);

  // `initial` separates the first load from a refresh. This used to blank the whole till
  // to "Loading…" twice on every single order — once to refresh the pending list, once
  // again for the print statuses — which is both jarring and exactly when the operator
  // is trying to ring up the next customer.
  async function loadCatalog({ initial = false } = {}) {
    if (initial) setLoading(true);
    setError(null);
    try {
      const [items, dealList, pending, held, methodList, config] = await Promise.all([
        menuItemsApi.getAll(),
        dealsApi.getAll(),
        ordersApi.getPending(),
        ordersApi.getHeld(),
        paymentMethodsApi.getAll(),
        posConfigApi.get(),
      ]);
      setMenuItems(items);
      setDeals(dealList);
      setPendingOrders(pending);
      setHeldOrders(held);
      setMethods(methodList);
      setPosConfig(config);
    } catch (err) {
      setError('Could not load sales data. ' + err.message);
    } finally {
      if (initial) setLoading(false);
    }
  }

  useEffect(() => { loadCatalog({ initial: true }); }, []);

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

  // Stepping below one removes the line. That is what the cart's "−" does at quantity 1,
  // so there is no separate Remove control competing for width in a 340px rail.
  function changeQty(key, newQty) {
    if (newQty <= 0) {
      setCartLines((lines) => lines.filter((l) => l.key !== key));
      return;
    }
    setCartLines((lines) => lines.map((l) => (l.key === key ? { ...l, quantity: newQty } : l)));
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

  // The cart, in the shape the orders API takes. Built in one place because all three ways out of
  // the till — a fresh sale, holding, and releasing a recalled order — send the same thing, and a
  // recalled order has to go back up exactly the way it first went up.
  //
  // created_by is not sent: the server files an order against whoever holds the session, so a till
  // cannot put a sale in someone else's name.
  function cartPayload(extra = {}) {
    return {
      ...extra,
      lines: cartLines.map((l) =>
        l.type === 'deal'
          ? { type: 'deal', deal_id: l.dealId, quantity: l.quantity }
          : { type: 'menu_item', menu_item_id: l.menuItemId, station_id: l.stationId, quantity: l.quantity, unit_price_cents: l.unitPriceCents }
      ),
    };
  }

  // Parks the cart. The till is handed back empty because the order is now somewhere else — the
  // held list below is the acknowledgement, which is why nothing else announces it.
  async function handleHoldOrder() {
    setHolding(true);
    setError(null);
    try {
      if (resumingId) await ordersApi.save(resumingId, cartPayload({ hold: true }));
      else await ordersApi.create(cartPayload({ hold: true }));

      setCartLines([]);
      setResumingId(null);
      await loadCatalog();
    } catch (err) {
      setError('Could not hold this order. ' + err.message);
    } finally {
      setHolding(false);
    }
  }

  // Recall rebuilds the cart and remembers which order it came from. The order itself is left on
  // hold until it is actually paid for: an operator who opens one held order and then another must
  // not end up with the first silently released, and a till that is closed mid-recall must not
  // leave an order looking paid for.
  function handleRecall(order) {
    // Recalling replaces whatever is in the cart, so it asks when there is something to lose —
    // a half-rung order silently swapped for another is one the operator has to key in again.
    if (cartLines.length > 0 && resumingId !== order.id
        && !window.confirm(`Replace the current order with ${order.ticket_number}?`)) {
      return;
    }

    setCartLines(cartLinesFrom(order.items ?? [], deals));
    setResumingId(order.id);
    setError(null);
  }

  async function handleDiscardHeld(orderId) {
    setDiscardingId(orderId);
    setError(null);
    try {
      await ordersApi.discard(orderId);
      if (resumingId === orderId) {
        setCartLines([]);
        setResumingId(null);
      }
      await loadCatalog();
    } catch (err) {
      setError('Could not discard the held order. ' + err.message);
    } finally {
      setDiscardingId(null);
    }
  }

  // The cart's button no longer submits anything — it opens the payment step, which is where
  // the order is actually committed. Everything the payment panel collected arrives here as
  // one object, so this stays the single place that talks to POST /orders.
  async function handleSubmitOrder(payment) {
    setSubmitting(true);
    setPayError(null);
    try {
      const payload = cartPayload(payment);
      // A recalled order is rewritten, not re-created: it keeps the ticket number it was held
      // under, and the day's records hold one order rather than a held one plus a paid one.
      // Omitting `hold` is what releases it — this is the moment the cart becomes a sale.
      const { orderId, ticket_number } = resumingId
        ? await ordersApi.save(resumingId, payload)
        : await ordersApi.create(payload);

      setCartLines([]);
      setResumingId(null);
      setPaymentOpen(false);
      await loadCatalog(); // refresh pending list to include the new order
      await attemptPrint(orderId, ticket_number);
      await loadCatalog(); // pick up the print statuses we just recorded
    } catch (err) {
      // Shown in the panel, not on the page: the cart is still there and the operator is
      // still looking at the payment form, so the message has to be where they are.
      setPayError(err.message);
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

  if (loading) return <div className="page">Loading…</div>;

  // Computed here and handed to both the cart and the payment panel. They used to each derive
  // their own, which is one expression in two places — and the two must agree, because the
  // panel is where the customer's money is counted against the total the cart is showing.
  const cartTotalCents = cartLines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);

  return (
    <div className={styles.screen}>
      {/* The menu column scrolls on its own. The rail beside it does not move at all, so
          the total and Submit Order stay where the operator left them no matter how many
          products are on screen. */}
      <div className={styles.left}>
        <PageHeader
          title="Sales"
          meta={`${menuItems.length} item${menuItems.length === 1 ? '' : 's'} · ${deals.length} deal${deals.length === 1 ? '' : 's'} · ${pendingOrders.length} pending${heldOrders.length > 0 ? ` · ${heldOrders.length} held` : ''}`}
        />

        {error && <Banner tone="danger" className={styles.warning}>{error}</Banner>}

        <MenuGrid
          menuItems={menuItems}
          deals={deals}
          onAddMenuItem={addMenuItemToCart}
          onAddDeal={addDealToCart}
        />
      </div>

      <div className={styles.rail}>
        <Cart
          lines={cartLines}
          totalCents={cartTotalCents}
          onChangeQty={changeQty}
          onSubmit={() => {
            setPayError(null);
            setPaymentOpen(true);
          }}
          onHold={handleHoldOrder}
          holding={holding}
          submitting={submitting}
          resumingTicket={resumingId ? heldOrders.find((o) => o.id === resumingId)?.ticket_number : null}
          onNewOrder={() => {
            setCartLines([]);
            setResumingId(null);
          }}
        />

        {/* Only rendered when there is something on hold. A panel that is empty almost all day
            would otherwise sit permanently in the rail taking half the room the pending orders
            need — and the header carries the count, so an operator who has parked a cart can see
            that one exists without the panel having to be there to say so. */}
        {heldOrders.length > 0 && (
          <HeldOrdersList
            orders={heldOrders}
            onRecall={handleRecall}
            onDiscard={handleDiscardHeld}
            discardingId={discardingId}
          />
        )}

        {printWarning && (
          <Banner
            tone="danger"
            className={styles.warning}
            title={`${printWarning.ticketNumber} did not print`}
            actions={
              <>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleRetryPrint(printWarning.orderId, printWarning.ticketNumber)}
                >
                  Retry printing
                </Button>
                <Button size="sm" variant="dangerGhost" onClick={() => setPrintWarning(null)}>
                  Dismiss
                </Button>
              </>
            }
          >
            <ul className={styles.failures}>
              {printWarning.failures.map((f, i) => (
                <li key={i}>{f.name}: {f.error}</li>
              ))}
            </ul>
          </Banner>
        )}

        <PendingOrdersList
          orders={pendingOrders}
          onComplete={handleCompleteOrder}
          completingId={completingId}
          onRetryPrint={handleRetryPrint}
          retryingId={retryingId}
        />
      </div>

      {paymentOpen && (
        <PaymentPanel
          totalCents={cartTotalCents}
          methods={methods}
          config={posConfig}
          onConfirm={handleSubmitOrder}
          onCancel={() => setPaymentOpen(false)}
          submitting={submitting}
          error={payError}
        />
      )}
    </div>
  );
}

export default SalesScreen;
