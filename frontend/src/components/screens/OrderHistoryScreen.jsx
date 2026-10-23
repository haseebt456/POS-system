import { useEffect, useState } from 'react';
import { ordersApi, paymentMethodsApi } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { daysAgoString, formatTime, isToday, localDateString } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { Badge, Banner, Button, Field, Icon, Input, PageHeader, Panel, Select, Table, Td, Th } from '../ui';
import styles from './OrderHistoryScreen.module.css';

const PAGE_SIZE = 50;

// The ranges a manager actually asks for, in the order they ask for them. "Today" is first
// because it is most of what anyone opens this screen for.
const RANGES = [
  { id: 'today', label: 'Today', from: () => localDateString(), to: () => localDateString() },
  { id: '7d', label: 'Last 7 days', from: () => daysAgoString(6), to: () => localDateString() },
  { id: '30d', label: 'Last 30 days', from: () => daysAgoString(29), to: () => localDateString() },
  { id: 'all', label: 'All time', from: () => '', to: () => '' },
];

const STATUSES = [
  { value: '', label: 'Any status' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
];

const STATUS_BADGE = {
  pending: { tone: 'warn', label: 'Pending' },
  completed: { tone: 'ok', label: 'Completed' },
};

// Not a module-level constant: `from` and `to` are today, and a shop that is still open at
// 00:30 must open this screen on the new day rather than on the one the file was imported
// during. Built fresh each time the screen mounts.
function initialFilters() {
  return {
    from: localDateString(),
    to: localDateString(),
    status: '',
    paymentMethodId: '',
    search: '',
    offset: 0,
  };
}

function OrderHistoryScreen() {
  const { isAdmin } = useAuth();

  // Every filter AND the page offset live in one object, updated through `patch` below.
  //
  // They were separate useState calls at first, and that is subtly wrong: changing a filter
  // and resetting the offset to 0 are two updates, so a screen sitting on page 3 fired one
  // request for the new filter at the old offset and a second one at offset 0. Whichever
  // came back last won, which is how a filter change shows an empty page for a moment.
  // One object means one update, one render, one request — and no way to get them out of step.
  const [query, setQuery] = useState(initialFilters);

  // The text in the search box, seconds ahead of the filter it becomes.
  const [searchInput, setSearchInput] = useState('');

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [methods, setMethods] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);

  function patch(changes) {
    setQuery((prev) => ({ ...prev, ...changes, offset: 0 }));
  }

  // Typing in the search box shouldn't fire a request per keystroke, and it shouldn't fire
  // one for a partial ticket number nobody has finished typing. One request, 300ms after the
  // typing stops.
  //
  // The equality check makes React bail out when the settled text is what is already being
  // filtered on — which is the case on mount, where it saves a duplicate fetch of the same
  // first page that the effect below has already asked for.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery((prev) =>
        prev.search === searchInput ? prev : { ...prev, search: searchInput, offset: 0 }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { from, to, status, paymentMethodId, search, offset } = query;

  // Bumped by Refresh. The effect below depends on the filter values, not on the `query`
  // object, so replacing that object with an identical copy would refetch nothing — a
  // counter is the honest way to say "the same request again".
  const [nonce, setNonce] = useState(0);

  // A counter, not the `query` object: depending on `query` would refetch on every render
  // that touched any part of it, and relying on the object's identity to mean "the filters
  // changed" is how a Refresh button quietly does nothing.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await ordersApi.list({
          from,
          to,
          status,
          payment_method_id: paymentMethodId,
          search,
          limit: PAGE_SIZE,
          offset,
        });
        if (!cancelled) setResult(data);
      } catch (err) {
        // A failed page must not leave the previous page's rows on screen dressed up as the
        // answer to the new filter — that is how a stale total gets read off a screen and
        // written into a notebook.
        if (!cancelled) {
          setResult(null);
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [from, to, status, paymentMethodId, search, offset, nonce]);

  // `all=1`: an order paid by a method that has since been retired still has to be findable
  // by that method's name, so the filter offers methods the till no longer shows.
  useEffect(() => {
    let cancelled = false;
    paymentMethodsApi
      .getAll(true)
      .then((list) => {
        if (!cancelled) setMethods(list);
      })
      .catch(() => {
        // Not worth an error banner: the history itself still works without this filter, so
        // the filter simply isn't offered.
        if (!cancelled) setMethods([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function openOrder(id) {
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
      setDetailError(null);
      return;
    }
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    try {
      setDetail(await ordersApi.getById(id));
    } catch (err) {
      setDetailError(err.message);
    }
  }

  // Which preset is in force is read off the dates rather than stored beside them. A stored
  // id would go on claiming "Last 7 days" after the dates under it were edited by hand —
  // a highlighted button describing something that is not true is worse than no highlight.
  const activeRange = RANGES.find((r) => r.from() === from && r.to() === to)?.id ?? null;

  const orders = result?.orders ?? [];
  const total = result?.total ?? 0;
  const showingTo = Math.min(offset + orders.length, total);

  // The takings summary is admin-only. Row totals are not — an operator has to see what a
  // customer owes in order to take payment for it — but an aggregate over a date range is
  // the "revenue analytics" the brief keeps away from the till. The server scopes an
  // operator's history to their own orders, so this number would be their own drawer
  // anyway; both halves of that rule are deliberate.
  const meta = loading
    ? 'Loading…'
    : `${total} order${total === 1 ? '' : 's'}` +
      (isAdmin && result ? ` · ${formatMoney(result.totals.total_cents)}` : '');

  return (
    <div className={`page stack ${styles.page}`}>
      <PageHeader
        title="Order History"
        meta={meta}
        actions={
          <Button
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={() => setNonce((n) => n + 1)}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      {error && (
        <Banner tone="danger" title="Could not load the order history">
          {error}
        </Banner>
      )}

      <div className={selectedId ? styles.split : undefined}>
        <div className={styles.main}>
          <Panel flush className={styles.filters}>
            <div className={styles.rangeRow}>
              {RANGES.map((preset) => (
                <Button
                  key={preset.id}
                  size="sm"
                  variant={activeRange === preset.id ? 'primary' : 'ghost'}
                  onClick={() => patch({ from: preset.from(), to: preset.to() })}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className={styles.filterGrid}>
              <Field label="From">
                <Input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => patch({ from: e.target.value })}
                />
              </Field>
              <Field label="To">
                <Input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => patch({ to: e.target.value })}
                />
              </Field>
              <Field label="Status">
                <Select value={status} onChange={(e) => patch({ status: e.target.value })}>
                  {STATUSES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Payment">
                <Select
                  value={paymentMethodId}
                  onChange={(e) => patch({ paymentMethodId: e.target.value })}
                >
                  <option value="">Any method</option>
                  {methods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                      {method.is_active === 0 ? ' (retired)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ticket number" className={styles.searchField}>
                <Input
                  type="search"
                  value={searchInput}
                  placeholder="T261011-1430"
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </Field>
            </div>
          </Panel>

          <Panel flush>
            {loading && !result ? (
              <p className={styles.state}>Loading orders…</p>
            ) : orders.length === 0 ? (
              <div className={styles.state}>
                <p className={styles.stateTitle}>No orders match these filters</p>
                <p className={styles.stateBody}>
                  {search || status || paymentMethodId
                    ? 'Try clearing a filter, or widening the dates.'
                    : 'Nothing has been rung up in this period yet.'}
                </p>
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Time</Th>
                    <Th>Ticket</Th>
                    <Th>Type</Th>
                    <Th align="right">Items</Th>
                    <Th>Payment</Th>
                    <Th>Cashier</Th>
                    <Th align="right">Total</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const badge = STATUS_BADGE[order.status] ?? { tone: 'neutral', label: order.status };
                    return (
                      <tr
                        key={order.id}
                        className={selectedId === order.id ? styles.selectedRow : undefined}
                        onClick={() => openOrder(order.id)}
                      >
                        {/* The day is prefixed only on rows that are not today's. A list
                            filtered to "Last 30 days" is not all one day, but repeating the
                            date down fifty rows of today's takings is fifty lines of noise. */}
                        <Td>
                          <span className={styles.time}>
                            {isToday(order.created_at) ? '' : `${order.created_at.slice(8, 10)}/${order.created_at.slice(5, 7)} `}
                            {formatTime(order.created_at)}
                          </span>
                        </Td>
                        <Td className={styles.ticket}>{order.ticket_number}</Td>
                        <Td>{order.order_type}</Td>
                        <Td align="right">{order.item_count}</Td>
                        <Td>
                          {order.payment_method_name ?? <span className={styles.unset}>Not recorded</span>}
                        </Td>
                        <Td>{order.created_by_name ?? <span className={styles.unset}>—</span>}</Td>
                        <Td align="right" className={styles.total}>
                          {formatMoney(order.total_amount_cents)}
                        </Td>
                        <Td>
                          <Badge tone={badge.tone}>{badge.label}</Badge>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}

            {total > 0 && (
              <div className={styles.pager}>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={offset === 0 || loading}
                  onClick={() => setQuery((prev) => ({ ...prev, offset: Math.max(0, prev.offset - PAGE_SIZE) }))}
                >
                  <Icon name="chevronLeft" size={16} /> Newer
                </Button>
                <span className={styles.pageCount}>
                  {offset + 1}–{showingTo} of {total}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={showingTo >= total || loading}
                  onClick={() => setQuery((prev) => ({ ...prev, offset: prev.offset + PAGE_SIZE }))}
                >
                  Older <Icon name="chevronRight" size={16} />
                </Button>
              </div>
            )}
          </Panel>
        </div>

        {selectedId && (
          <aside className={styles.detail}>
            <OrderDetail
              order={detail}
              error={detailError}
              onClose={() => {
                setSelectedId(null);
                setDetail(null);
                setDetailError(null);
              }}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

// One order, as it was rung up. Every number here is a stored snapshot — the price a line
// sold for, the discount that was given, the method it was paid by — because a menu price
// change must not alter what a past order came to.
function OrderDetail({ order, error, onClose }) {
  return (
    <Panel
      title={order ? `Ticket ${order.ticket_number}` : 'Order'}
      actions={
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close the order">
          <Icon name="close" size={16} />
        </Button>
      }
      className={styles.detailPanel}
    >
      {error ? (
        <Banner tone="danger" title="Could not load this order">
          {error}
        </Banner>
      ) : !order ? (
        <p className={styles.state}>Loading…</p>
      ) : (
        <div className={styles.detailBody}>
          <dl className={styles.facts}>
            <div>
              <dt>Rung up</dt>
              <dd>
                {order.created_at.slice(8, 10)}/{order.created_at.slice(5, 7)}/{order.created_at.slice(0, 4)}{' '}
                {formatTime(order.created_at)}
              </dd>
            </div>
            <div>
              <dt>Cashier</dt>
              <dd>{order.created_by_name ?? '—'}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{order.order_type}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{order.payment_method_name ?? 'Not recorded'}</dd>
            </div>
          </dl>

          <div>
            <h3 className={styles.sectionTitle}>Items</h3>
            <ul className={styles.lines}>
              {order.items.map((item) => {
                // A deal's components are shown as the deal, once — the printed receipt
                // collapses them the same way, and the customer bought the bundle. The money
                // sits on the deal's first row, so the rest are skipped rather than listed at
                // Rs. 0, which would read as free items.
                if (item.deal_id && item.line_total_cents === 0) return null;

                return (
                  <li key={item.id} className={styles.line}>
                    <span className={styles.lineQty}>
                      {item.deal_id ? item.deal_quantity ?? 1 : item.quantity}x
                    </span>
                    <span className={styles.lineName}>{item.deal_name ?? item.menu_item_name}</span>
                    <span className={styles.lineAmount}>{formatMoney(item.line_total_cents)}</span>
                    {item.deal_name && (
                      <span className={styles.lineNote}>
                        contains {item.quantity}x {item.menu_item_name}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <dl className={styles.money}>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(order.subtotal_cents ?? order.total_amount_cents)}</dd>
            </div>
            {order.discount_cents > 0 && (
              <div className={styles.discount}>
                <dt>
                  Discount
                  {order.discount_reason ? <span className={styles.reason}> · {order.discount_reason}</span> : null}
                </dt>
                <dd>−{formatMoney(order.discount_cents)}</dd>
              </div>
            )}
            {order.tax_cents > 0 && (
              <div>
                <dt>Tax</dt>
                <dd>{formatMoney(order.tax_cents)}</dd>
              </div>
            )}
            <div className={styles.grandTotal}>
              <dt>Total</dt>
              <dd>{formatMoney(order.total_amount_cents)}</dd>
            </div>
            {order.amount_tendered_cents !== null && order.amount_tendered_cents !== undefined && (
              <>
                <div>
                  <dt>Cash received</dt>
                  <dd>{formatMoney(order.amount_tendered_cents)}</dd>
                </div>
                <div>
                  <dt>Change given</dt>
                  <dd>{formatMoney(order.change_cents)}</dd>
                </div>
              </>
            )}
          </dl>

          <p className={styles.footNote}>
            {STATUS_BADGE[order.status]?.label ?? order.status} ·{' '}
            {order.receipt_print_status === 'printed'
              ? 'receipt printed'
              : order.receipt_print_status === 'failed'
                ? 'receipt failed to print'
                : 'receipt not printed'}
          </p>
        </div>
      )}
    </Panel>
  );
}

export default OrderHistoryScreen;
