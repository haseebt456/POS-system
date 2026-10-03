import { useState, useEffect } from 'react';
import { ingredientsApi } from '../../api/client';
import IngredientForm from '../inventory/IngredientForm';
import IngredientTable from '../inventory/IngredientTable';
import StockCountPanel from '../inventory/StockCountPanel';

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

  return (
    <div style={{ padding: '24px 20px' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Inventory</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>{ingredients.length} ingredients</span>
          {!counting && trackableCount > 0 && (
            <button
              style={{ padding: '9px 16px', fontSize: 14, fontWeight: 600, background: '#fff', color: '#2563eb', border: '1px solid #93b4f5', borderRadius: 8, cursor: 'pointer' }}
              onClick={() => { setCounting(true); cancelEdit(); }}
            >
              Physical count
            </button>
          )}
        </div>
      </header>

      {error && (
        <div style={{ background: '#fdecea', color: '#a32b1f', padding: '12px 16px', borderRadius: 8, marginBottom: 18, fontSize: 14, border: '1px solid #f3c8c2' }}>
          {error}
        </div>
      )}

      {counting && (
        <StockCountPanel
          ingredients={ingredients}
          submitting={countSubmitting}
          onSubmit={handleReconcile}
          onCancel={() => setCounting(false)}
        />
      )}

      {!counting && (
        <IngredientForm
          form={form}
          setForm={setForm}
          fieldErrors={fieldErrors}
          editingId={editingId}
          onSubmit={handleSubmit}
          onCancel={cancelEdit}
        />
      )}

      <IngredientTable
        ingredients={ingredients}
        lowStockIds={lowStockIds}
        loading={loading}
        onEdit={startEdit}
        onDeactivate={handleDeactivate}
      />
    </div>
  );
}

export default InventoryScreen;
