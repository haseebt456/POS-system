import { useEffect, useState } from 'react';
import { ingredientsApi, stockMovementsApi } from '../../api/client';
import { daysAgoString, formatDateTime, localDateString } from '../../lib/format';
import { Badge, Banner, Button, Field, Icon, Input, PageHeader, Panel, Select, Table, Td, Th } from '../ui';
import styles from './StockMovementsScreen.module.css';

const PAGE_SIZE = 100;

// Same presets as the order history, and deliberately the same order. Two screens that both ask
// "what happened today" should ask it the same way.
const RANGES = [
  { id: 'today', label: 'Today', from: () => localDateString(), to: () => localDateString() },
  { id: '7d', label: 'Last 7 days', from: () => daysAgoString(6), to: () => localDateString() },
  { id: '30d', label: 'Last 30 days', from: () => daysAgoString(29), to: () => localDateString() },
  { id: 'all', label: 'All time', from: () => '', to: () => '' },
];

// How each reason reads to a person. The stored codes are single words chosen for the database;
// "sale" on a stock ledger means "sold, so it left the building", which is not obvious to
// someone scanning the column for a delivery that never arrived.
const REASON_LABEL = {
  opening: 'Opening balance',
  purchase: 'Delivery received',
  sale: 'Sold',
  adjustment: 'Stock count',
  waste: 'Waste',
};

// A movement is a change, and the direction is the first thing anyone reads: stock going out is
// the one that needs explaining.
const REASON_TONE = {
  opening: 'neutral',
  purchase: 'ok',
  sale: 'info',
  adjustment: 'warn',
  waste: 'danger',
};

function initialFilters() {
  return {
    from: daysAgoString(6),
    to: localDateString(),
    ingredientId: '',
    reason: '',
    offset: 0,
  };
}

function StockMovementsScreen() {
  // One object for every filter and the page offset, for the reason spelled out in
  // OrderHistoryScreen: two useState calls means two updates, which means one request at the
  // old offset and one at zero, and whichever returns last wins.
  const [query, setQuery] = useState(initialFilters);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ingredients, setIngredients] = useState([]);

  const { from, to, ingredientId, reason, offset } = query;

  function patch(changes) {
    setQuery((prev) => ({ ...prev, ...changes, offset: 0 }));
  }

  function reset() {
    setQuery(initialFilters());
  }

  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await stockMovementsApi.list({
          from,
          to,
          ingredient_id: ingredientId,
          reason,
          limit: PAGE_SIZE,
          offset,
        });
        if (!cancelled) setResult(data);
      } catch (err) {
        // Drop the previous page rather than leaving it on screen under the new filters — a
        // stale ledger reads as the answer to the question that was just asked.
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
  }, [from, to, ingredientId, reason, offset, nonce]);

  useEffect(() => {
    let cancelled = false;
    ingredientsApi
      .getAll()
      .then((list) => {
        if (!cancelled) setIngredients(list);
      })
      .catch(() => {
        // The filter simply isn't offered if the list can't be read; the ledger still works.
        if (!cancelled) setIngredients([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Derived from the dates rather than stored beside them — a highlighted preset that outlives
  // the dates it describes is worse than no highlight.
  const activeRange = RANGES.find((r) => r.from() === from && r.to() === to)?.id ?? null;

  const movements = result?.movements ?? [];
  const total = result?.total ?? 0;
  const showingTo = Math.min(offset + movements.length, total);
  const filtered = Boolean(ingredientId || reason || activeRange !== 'all');

  return (
    <div className={`page stack ${styles.page}`}>
      <PageHeader
        title="Stock Movements"
        meta={
          loading
            ? 'Loading…'
            : `${total} movement${total === 1 ? '' : 's'}` +
              (result ? ` · net ${formatDelta(result.totals.net_delta)}` : '')
        }
        actions={
          <Button variant="ghost" size="sm" disabled={loading} onClick={() => setNonce((n) => n + 1)}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      {error && (
        <Banner tone="danger" title="Could not load the stock movements">
          {error}
        </Banner>
      )}

      <div className={styles.split}>
        {/* The filter rail, per the reference's list screens: filters down the left, data on
            the right, and Reset pinned at the bottom where it is found rather than hunted for. */}
        <aside className={styles.rail}>
          <Panel title="Filters" className={styles.railPanel}>
            <div className={styles.railBody}>
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

              <Field label="Ingredient">
                <Select
                  value={ingredientId}
                  onChange={(e) => patch({ ingredientId: e.target.value })}
                >
                  <option value="">All ingredients</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Reason">
                <Select value={reason} onChange={(e) => patch({ reason: e.target.value })}>
                  <option value="">Any reason</option>
                  {Object.entries(REASON_LABEL).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className={styles.railFooter}>
              <Button variant="ghost" size="sm" onClick={reset} disabled={!filtered}>
                Reset filters
              </Button>
            </div>
          </Panel>
        </aside>

        <div className={styles.main}>
          {/* The whole filtered set, not the page — the question is "how much mince moved this
              week", and the rows on screen are only part of the answer. */}
          {result && (
            <div className={styles.summary}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Added</span>
                <span className={styles.summaryValueIn}>{formatDelta(result.totals.added)}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Removed</span>
                <span className={styles.summaryValueOut}>{formatDelta(result.totals.removed)}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Net</span>
                <span className={styles.summaryValue}>{formatDelta(result.totals.net_delta)}</span>
              </div>
            </div>
          )}

          <Panel flush>
            {loading && !result ? (
              <p className={styles.state}>Loading movements…</p>
            ) : movements.length === 0 ? (
              <div className={styles.state}>
                <p className={styles.stateTitle}>No stock moved in this period</p>
                <p className={styles.stateBody}>
                  {filtered
                    ? 'Try clearing a filter, or widening the dates.'
                    : 'Deliveries, sales and stock counts all appear here as they happen.'}
                </p>
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Ingredient</Th>
                    <Th align="right">Change</Th>
                    <Th>Reason</Th>
                    <Th>Reference</Th>
                    <Th>Recorded by</Th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <Td className={styles.when}>{formatDateTime(movement.created_at)}</Td>
                      <Td>
                        {movement.ingredient_name ?? (
                          <span className={styles.unset}>Deleted ingredient</span>
                        )}
                      </Td>
                      <Td align="right" className={movement.delta < 0 ? styles.out : styles.in}>
                        {formatDelta(movement.delta)} {movement.unit}
                      </Td>
                      <Td>
                        <Badge tone={REASON_TONE[movement.reason] ?? 'neutral'}>
                          {REASON_LABEL[movement.reason] ?? movement.reason}
                        </Badge>
                      </Td>
                      <Td className={styles.reference}>{movement.note ?? referenceOf(movement)}</Td>
                      <Td>{movement.created_by_name ?? <span className={styles.unset}>—</span>}</Td>
                    </tr>
                  ))}
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
      </div>
    </div>
  );
}

// A signed number with an explicit + and a thin space, because a column of bare numbers is read
// as magnitudes and the whole point of the column is which way the stock went.
function formatDelta(value) {
  const number = Number(value) || 0;
  if (number === 0) return '0';
  return `${number > 0 ? '+' : '−'}${Math.abs(number)}`;
}

// "purchase #12" for a row written before notes existed, or one written by a path that had
// nothing more useful to say. Better than an empty cell that looks like missing data.
function referenceOf(movement) {
  if (!movement.ref_type) return '—';
  return `${movement.ref_type} #${movement.ref_id}`;
}

export default StockMovementsScreen;
