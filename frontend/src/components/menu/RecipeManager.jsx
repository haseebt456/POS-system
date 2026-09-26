import { useState, useEffect } from 'react';
import { menuItemsApi } from '../../api/client';

const styles = {
  wrap: { background: '#fafbfc', borderTop: '1px solid #f0f1f3', padding: '12px 16px' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 },
  addRow: { display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' },
  select: { flex: '1 1 160px', padding: '7px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, color: '#22262b' },
  input: { flex: '0 1 100px', padding: '7px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, color: '#22262b' },
  button: { padding: '7px 14px', fontSize: 13, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' },
  removeButton: { background: 'none', border: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer' },
  empty: { fontSize: 13, color: '#9ca3af', padding: '4px 0' },
};

function RecipeManager({ menuItemId, ingredients }) {
  const [recipe, setRecipe] = useState([]);
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? '');
  const [qty, setQty] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await menuItemsApi.getRecipe(menuItemId);
    setRecipe(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [menuItemId]);

  async function handleAdd() {
    if (!ingredientId || !qty) return;
    await menuItemsApi.addRecipeItem(menuItemId, Number(ingredientId), Number(qty));
    setQty('');
    await load();
  }

  if (loading) return <div style={styles.wrap}><span style={styles.empty}>Loading recipe…</span></div>;

  return (
    <div style={styles.wrap}>
      {recipe.length === 0 ? (
        <div style={styles.empty}>No recipe defined yet — this item won't deduct any ingredient stock.</div>
      ) : (
        recipe.map((r) => (
          <div key={r.id} style={styles.row}>
            <span>{r.ingredient_name} — {r.quantity_required} {r.unit}</span>
            <button style={styles.removeButton} onClick={async () => { await menuItemsApi.removeRecipeItem(r.id); await load(); }}>Remove</button>
          </div>
        ))
      )}
      <div style={styles.addRow}>
        <select style={styles.select} value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}>
          {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <input style={styles.input} type="number" step="any" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
        <button style={styles.button} onClick={handleAdd}>Add to recipe</button>
      </div>
    </div>
  );
}

export default RecipeManager;
