import { useState, useEffect } from 'react';
import { menuItemsApi, dealsApi, ingredientsApi, stationsApi, categoriesApi } from '../../api/client';
import MenuItemList from '../menu/MenuItemList';
import MenuItemForm from '../menu/MenuItemForm';
import DealForm from '../menu/DealForm';
import DealList from '../menu/DealList';
import { Banner, PageHeader } from '../ui';

function MenuManagementScreen() {
  const [menuItems, setMenuItems] = useState([]);
  const [deals, setDeals] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [stations, setStations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // `initial` distinguishes the first load from a refresh after a write. Without it every
  // add blanked the whole screen to "Loading…" and remounted the form — on a screen whose
  // entire job is keying in a list of menu items, that flash lands on every single row.
  async function loadAll({ initial = false } = {}) {
    if (initial) setLoading(true);
    setError(null);
    try {
      const [items, dealRows, ingredientRows, stationRows, categoryRows] = await Promise.all([
        menuItemsApi.getAll(),
        dealsApi.getAll(),
        ingredientsApi.getAll(),
        stationsApi.getAll(),
        categoriesApi.getAll(),
      ]);
      setMenuItems(items);
      setDeals(dealRows);
      setIngredients(ingredientRows);
      setStations(stationRows);
      setCategories(categoryRows);
    } catch (err) {
      setError('Could not load menu data. ' + err.message);
    } finally {
      if (initial) setLoading(false);
    }
  }

  useEffect(() => { loadAll({ initial: true }); }, []);

  // Both create handlers now report the outcome instead of letting the rejection escape.
  // Previously there was no try/catch at all, so a save that failed did nothing visible:
  // no message, and the row simply never appeared.
  async function handleCreateMenuItem(data) {
    try {
      await menuItemsApi.create(data);
      await loadAll();
      return true;
    } catch (err) {
      setError('Could not add menu item. ' + err.message);
      return false;
    }
  }

  async function handleCreateDeal(data) {
    try {
      await dealsApi.create(data);
      await loadAll();
      return true;
    } catch (err) {
      setError('Could not add deal. ' + err.message);
      return false;
    }
  }

  if (loading) return <div className="page">Loading…</div>;

  return (
    <div className="page stack">
      <PageHeader
        title={'Menu & Deals'}
        meta={`${menuItems.length} item${menuItems.length === 1 ? '' : 's'} · ${deals.length} deal${deals.length === 1 ? '' : 's'}`}
      />

      {error && <Banner tone="danger">{error}</Banner>}

      {/* A setup condition, not a failure — nothing has gone wrong, the shop just hasn't
          been configured yet. Amber rather than red for that reason. */}
      {stations.length === 0 && (
        <Banner tone="warn" title="No print stations yet">
          Add at least one on the <strong>Printers</strong> tab. A menu item can't be
          created without one, because every item has to know which printer its ticket goes to.
        </Banner>
      )}
      <MenuItemForm  categories={categories} stations={stations} onSave={handleCreateMenuItem} />
      <MenuItemList menuItems={menuItems} ingredients={ingredients} stations={stations} />

      <DealForm onCreate={handleCreateDeal} />
      <DealList deals={deals} menuItems={menuItems} />
    </div>
  );
}

export default MenuManagementScreen;
