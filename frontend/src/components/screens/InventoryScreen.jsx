import { useState, useEffect, useMemo } from 'react';
import { ingredientsApi } from '../../api/client';
import IngredientForm from '../inventory/IngredientForm';
import IngredientTable from '../inventory/IngredientTable';
import StockCountPanel from '../inventory/StockCountPanel';
import { PageHeader, Banner, Button, Field, Input, Panel, Select } from '../ui';
import styles from './InventoryScreen.module.css';

const EMPTY_FORM = { name: '', unit: 'kg', stock_qty: '', low_stock_threshold: '', is_trackable: true };

function validateForm(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Name is required.';
  if (form.stock_qty !== '' && (isNaN(form.stock_qty) || Number(form.stock_qty) < 0)) {
    errors.stock_qty = 'Stock must be zero or a positive number.';
  }
  if (form.low_stock_threshold !== '' && (isNaN(form.low_stock_threshold) || Number(form.low_stock_threshold) < 0)) {
    errors.low_stock_threshold = 'Threshold must be zero or a positive number.';
  }
  return errors;
}

// Deliberately no "sort by quantity". These ingredients are measured in different units, so 3kg
// and 3pcs are not comparable and any ordering by that column would be an arbitrary one wearing
// the clothes of a ranking. What a shop actually asks is "what needs attention", and the
// low-stock flag — which is threshold-aware and per-unit — is the honest answer to that.
const DEFAULT_SORT = 'name';
const SORTS = [
  { id: 'name', label: 'Name (A–Z)' },
  { id: 'low', label: 'Low stock first' },
];

function InventoryScreen() {
  const [ingredients, setIngredients] = useState([]);
  const [lowStockIds, setLowStockIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [counting, setCounting] = useState(false);
  const [countSubmitting, setCountSubmitting] = useState(false);

  // Filters. Kept in one object for the reason given in StockMovementsScreen: several useState
  // calls means several renders, and the table is derived from all of them at once.
  const [filters, setFilters] = useState({ search: '', lowOnly: false, sort: DEFAULT_SORT });

  async function loadIngredients() {
    setLoading(true);
    setError(null);
    try {
      const [all, lowStock] = await Promise.all([ingredientsApi.getAll(), ingredientsApi.getLowStock()]);
      setIngredients(all);
      setLowStockIds(new Set(lowStock.map((i) => i.id)));
    } catch (err) {
      setError('Could not load ingredients. ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadIngredients(); }, []);

  const { search, lowOnly, sort } = filters;

  function patch(changes) {
    setFilters((prev) => ({ ...prev, ...changes }));
  }

  // Filtering and sorting happen here rather than in a request: the whole ingredient list is a
  // few dozen rows loaded in one go, and a round trip per keystroke would make the search feel
  // worse than the list it is searching.
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();

    const matched = ingredients.filter((ing) => {
      if (needle && !ing.name.toLowerCase().includes(needle)) return false;
      if (lowOnly && !lowStockIds.has(ing.id)) return false;
      return true;
    });

    // Ties break on name, so the order is stable between renders and two ingredients that are
    // both low don't swap places every time the list reloads.
    return matched.sort((a, b) => {
      if (sort === 'low') {
        const rank = (ing) => (lowStockIds.has(ing.id) ? 0 : 1);
        const byRank = rank(a) - rank(b);
        if (byRank !== 0) return byRank;
      }
      return a.name.localeCompare(b.name);
    });
  }, [ingredients, lowStockIds, search, lowOnly, sort]);

  const lowCount = visible.filter((ing) => lowStockIds.has(ing.id)).length;
  const untrackedCount = visible.filter((ing) => !ing.is_trackable).length;
  // Two different questions, so two different flags. `filtered` says "these controls differ from
  // their defaults" and drives the Reset button; `narrowed` says "something is being hidden" and
  // drives the empty state. Sorting changes no result count, so on an empty catalogue it must not
  // be able to claim that a filter excluded everything.
  const narrowed = search.trim() !== '' || lowOnly;
  const filtered = narrowed || sort !== DEFAULT_SORT;

  function startEdit(ing) {
    setEditingId(ing.id);
    setForm({
      name: ing.name,
      unit: ing.unit,
      stock_qty: String(ing.stock_qty),
      low_stock_threshold: String(ing.low_stock_threshold),
      is_trackable: !!ing.is_trackable,
    });
    setFieldErrors({});
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validateForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      if (editingId === null) {
        await ingredientsApi.create({
          name: form.name.trim(),
          unit: form.unit,
          stock_qty: form.stock_qty === '' ? 0 : Number(form.stock_qty),
          low_stock_threshold: form.low_stock_threshold === '' ? 0 : Number(form.low_stock_threshold),
          is_trackable: form.is_trackable ? 1 : 0,
        });
      } else {
        await ingredientsApi.update(editingId, {
          name: form.name.trim(),
          unit: form.unit,
          low_stock_threshold: form.low_stock_threshold === '' ? 0 : Number(form.low_stock_threshold),
          is_trackable: form.is_trackable ? 1 : 0,
        });
        if (form.stock_qty !== '') {
          await ingredientsApi.setStock(editingId, Number(form.stock_qty));
        }
      }
      cancelEdit();
      await loadIngredients();
    } catch (err) {
      setError((editingId === null ? 'Could not add ingredient. ' : 'Could not update ingredient. ') + err.message);
    }
  }

  async function handleDeactivate(id, name) {
    if (!window.confirm(`Remove "${name}" from the active ingredient list? Past orders and purchases referencing it are unaffected.`)) return;
    try {
      await ingredientsApi.deactivate(id);
      if (editingId === id) cancelEdit();
      await loadIngredients();
    } catch (err) {
      setError('Could not remove ingredient. ' + err.message);
    }
  }

  // Applies a whole physical count in one request. The backend wraps it in a
  // transaction, so a failure part-way can't leave some rows updated and others not.
  async function handleReconcile(entries) {
    setCountSubmitting(true);
    setError(null);
    try {
      await ingredientsApi.reconcile(entries);
      setCounting(false);
      await loadIngredients();
    } catch (err) {
      setError('Could not apply physical count. ' + err.message);
    } finally {
      setCountSubmitting(false);
    }
  }

  const trackableCount = ingredients.filter((i) => i.is_trackable).length;

  if (loading) return <div className="page">Loading…</div>;

  return (
    <div className={`page stack ${styles.page}`}>
      <PageHeader
        title="Stock"
        meta={`${ingredients.length} ingredient${ingredients.length === 1 ? '' : 's'} · ${lowStockIds.size} low`}
        actions={
          !counting && trackableCount > 0 ? (
            <Button variant="secondary" onClick={() => { setCounting(true); cancelEdit(); }}>
              Physical count
            </Button>
          ) : null
        }
      />

      {error && <Banner tone="danger">{error}</Banner>}

      <div className={styles.split}>
        <aside className={styles.rail}>
          <Panel title="Filters" className={styles.railPanel}>
            <div className={styles.railBody}>
              <Field label="Search">
                <Input
                  type="search"
                  placeholder="Ingredient name…"
                  value={search}
                  onChange={(e) => patch({ search: e.target.value })}
                />
              </Field>

              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={lowOnly}
                  onChange={(e) => patch({ lowOnly: e.target.checked })}
                />
                Low stock only
              </label>

              <Field label="Order">
                <Select value={sort} onChange={(e) => patch({ sort: e.target.value })}>
                  {SORTS.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className={styles.railFooter}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ search: '', lowOnly: false, sort: DEFAULT_SORT })}
                disabled={!filtered}
              >
                Reset filters
              </Button>
            </div>
          </Panel>
        </aside>

        <div className={styles.main}>
          {/* Counting and editing are the two things this screen is for, and they are mutually
              exclusive — you cannot correct the shelf while typing a new ingredient. */}
          {counting ? (
            <StockCountPanel
              ingredients={ingredients}
              submitting={countSubmitting}
              onSubmit={handleReconcile}
              onCancel={() => setCounting(false)}
            />
          ) : (
            <IngredientForm
              form={form}
              setForm={setForm}
              fieldErrors={fieldErrors}
              editingId={editingId}
              onSubmit={handleSubmit}
              onCancel={cancelEdit}
            />
          )}

          {/* Counts describe what is on screen, not the whole catalogue — the header above
              already carries the catalogue total, and two different totals on one page without
              labels saying which is which is how people stop trusting both. */}
          <div className={styles.summary}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Ingredients</span>
              <span className={styles.summaryValue}>{visible.length}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Low stock</span>
              <span className={lowCount > 0 ? styles.summaryValueWarn : styles.summaryValue}>
                {lowCount}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Not tracked</span>
              <span className={untrackedCount > 0 ? styles.summaryValue : styles.summaryValueMuted}>
                {untrackedCount}
              </span>
            </div>
          </div>

          {/* The table's own empty state says "Add your first one above", which is wrong when the
              list is empty because a filter hid everything — so a filtered miss is answered here
              instead, and the table only ever renders a genuinely empty catalogue. */}
          {narrowed && visible.length === 0 ? (
            <Panel flush>
              <div className={styles.state}>
                <p className={styles.stateTitle}>No ingredients match these filters</p>
                <p className={styles.stateBody}>Try a shorter search, or turn off "low stock only".</p>
              </div>
            </Panel>
          ) : (
            <IngredientTable
              ingredients={visible}
              lowStockIds={lowStockIds}
              loading={false}
              onEdit={startEdit}
              onDeactivate={handleDeactivate}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default InventoryScreen;
