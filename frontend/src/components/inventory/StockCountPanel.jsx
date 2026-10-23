import { useState } from 'react';
import { Panel, Table, Th, Td, Button, Input } from '../ui';
import styles from './StockCountPanel.module.css';

function StockCountPanel({ ingredients, onSubmit, onCancel, submitting }) {
  const [counts, setCounts] = useState({});

  // Only trackable items appear: untrackable ones (sauces, ketchup) have no
  // meaningful countable unit, so a "physical count" for them would be noise.
  const trackable = ingredients.filter((i) => i.is_trackable);

  function setCount(id, value) {
    setCounts((prev) => ({ ...prev, [id]: value }));
  }

  // Only rows the operator actually filled in are submitted — leaving a box blank
  // means "I didn't count this", not "this is now zero".
  const entries = trackable
    .filter((i) => counts[i.id] !== undefined && counts[i.id] !== '')
    .map((i) => ({ id: i.id, actual_qty: Number(counts[i.id]) }))
    .filter((e) => !Number.isNaN(e.actual_qty) && e.actual_qty >= 0);

  const changedCount = entries.filter((e) => {
    const current = trackable.find((i) => i.id === e.id)?.stock_qty;
    return current !== e.actual_qty;
  }).length;

  async function handleSubmit() {
    if (entries.length === 0) return;
    await onSubmit(entries);
    setCounts({});
  }

  return (
    <Panel className={styles.counting} title="Physical count">
      <p className={styles.sub}>
        Enter what you actually counted on the shelf. Only the rows you fill in are changed —
        leave a box blank to skip that item. This <strong>overwrites</strong> the system figure,
        so it is for counting, not for adding or removing stock.
      </p>

      <Table>
        <thead>
          <tr>
            <Th>Ingredient</Th>
            <Th align="right">System says</Th>
            <Th align="right">Actual count</Th>
            <Th>Difference</Th>
          </tr>
        </thead>
        <tbody>
          {trackable.map((ing) => {
            const raw = counts[ing.id];
            const hasValue = raw !== undefined && raw !== '';
            const variance = hasValue ? Number(raw) - ing.stock_qty : null;

            return (
              <tr key={ing.id}>
                <Td>{ing.name}</Td>
                <Td align="right">
                  {ing.stock_qty} {ing.unit}
                </Td>
                <Td align="right">
                  {/* The column heading is the visible label; this names the control for
                      anyone not reading the table by sight. */}
                  <span className={styles.countWrap}>
                    <Input
                      aria-label={`Actual count for ${ing.name}`}
                      type="number" min="0" step="0.01" placeholder="—"
                      value={raw ?? ''}
                      onChange={(e) => setCount(ing.id, e.target.value)}
                    />
                  </span>
                </Td>
                <Td>
                  {variance === null || Number.isNaN(variance) ? (
                    <span className={styles.varianceSame}>—</span>
                  ) : variance === 0 ? (
                    <span className={styles.varianceSame}>no change</span>
                  ) : variance > 0 ? (
                    <span className={styles.varianceUp}>+{variance} {ing.unit}</span>
                  ) : (
                    <span className={styles.varianceDown}>{variance} {ing.unit}</span>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <div className={styles.actions}>
        <Button variant="primary" disabled={entries.length === 0 || submitting} onClick={handleSubmit}>
          {submitting ? 'Saving…' : `Apply count (${entries.length})`}
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        {changedCount > 0 && (
          <span className={styles.summary}>
            {changedCount} of {entries.length} counted items will change
          </span>
        )}
      </div>
    </Panel>
  );
}

export default StockCountPanel;
