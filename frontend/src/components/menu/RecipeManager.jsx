import { useState, useEffect } from 'react';
import { menuItemsApi } from '../../api/client';
import { Button, Input, Select } from '../ui';
import styles from './RecipeManager.module.css';

function RecipeManager({ menuItemId, ingredients }) {
  const [recipe, setRecipe] = useState([]);
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? '');
  const [qty, setQty] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    try {
      setRecipe(await menuItemsApi.getRecipe(menuItemId));
      setError(null);
    } catch (err) {
      // Previously this await rejected inside useEffect, so setLoading(false) never ran
      // and the row sat on "Loading recipe…" permanently with no way to recover. A
      // failed fetch has to end the loading state too.
      setError('Could not load recipe. ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [menuItemId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!ingredientId || !qty) return;
    try {
      await menuItemsApi.addRecipeItem(menuItemId, Number(ingredientId), Number(qty));
      setQty('');
      await load();
    } catch (err) {
      setError('Could not add ingredient. ' + err.message);
    }
  }

  async function handleRemove(recipeItemId) {
    try {
      await menuItemsApi.removeRecipeItem(recipeItemId);
      await load();
    } catch (err) {
      setError('Could not remove ingredient. ' + err.message);
    }
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.empty}>Loading recipe…</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {error && <p className={styles.error}>{error}</p>}

      {/* No empty message when the load failed — "no recipe defined" would be a claim
          about data we never managed to read. */}
      {recipe.length === 0 && !error && (
        <p className={styles.empty}>
          No recipe defined yet — this item won&apos;t deduct any ingredient stock.
        </p>
      )}

      {recipe.length > 0 && (
        <div className={styles.list}>
          {recipe.map((r) => (
            <div key={r.id} className={styles.row}>
              <span>{r.ingredient_name} — {r.quantity_required} {r.unit}</span>
              <Button variant="dangerGhost" size="sm" onClick={() => handleRemove(r.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* A form, not a div: pressing Enter in the quantity box now adds the row, which
          is how anyone types a recipe in. */}
      <form className={styles.addRow} onSubmit={handleAdd}>
        <Select
          aria-label="Ingredient"
          className={styles.select}
          value={ingredientId}
          onChange={(e) => setIngredientId(e.target.value)}
          disabled={ingredients.length === 0}
        >
          {ingredients.length === 0 && <option value="">No ingredients yet</option>}
          {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </Select>

        <Input
          aria-label="Quantity required"
          className={styles.qty}
          type="number" step="any" min="0" placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />

        <Button type="submit" variant="secondary" size="sm" disabled={ingredients.length === 0}>
          Add to recipe
        </Button>
      </form>
    </div>
  );
}

export default RecipeManager;
