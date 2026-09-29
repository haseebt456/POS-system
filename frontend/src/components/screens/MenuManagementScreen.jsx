import {useState, useEffect} from 'react'
import {menuItemsApi, dealsApi, ingredientsApi, stationsApi} from '../../api/client'
import MenuItemList from '../menu/MenuItemList'
import MenuItemForm from '../menu/MenuItemForm'
import DealForm from '../menu/DealForm'
import DealList from '../menu/DealList'


function MenuManagementScreen() {
    const [menuItems, setMenuItems] = useState([])
    const [deals, setDeals] = useState([])
    const [ingredients, setIngredients] = useState([])
    const [stations, setStations] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    async function loadAll() {
        setLoading(true)
        setError(null)
        try {
            const [menuItems, deals, ingredients, stations] = await Promise.all([
                menuItemsApi.getAll(),
                dealsApi.getAll(),
                ingredientsApi.getAll(),
                stationsApi.getAll()
            ])
            setMenuItems(menuItems)
            setDeals(deals)
            setIngredients(ingredients)
            setStations(stations)
        } catch (err) {
            setError("Could not load menu data: " + err.message)
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => {
        loadAll();
    }, [])
    async function handleCreateMenuItem(data) {
        await menuItemsApi.create(data)
        await loadAll()
    }
    async function handleCreateDeal(data) { 
        await dealsApi.create(data) 
        await loadAll()
    }
    if (loading) return <div style={{padding: 24}}>Loading…</div>;

  return (
 <div style={{ padding: '24px 20px', maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 16px' }}>Menu &amp; Deals</h1>

      {error && (
        <div style={{ background: '#fdecea', color: '#a32b1f', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, border: '1px solid #f3c8c2' }}>
          {error}
        </div>
      )}

      {stations.length === 0 && (
        <div style={{ background: '#fdecea', color: '#a32b1f', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, border: '1px solid #f3c8c2' }}>
          No printer stations exist yet — add at least one via the API before creating menu items (a menu item can't be created without one).
        </div>
      )}

      <MenuItemForm stations={stations} onCreate={handleCreateMenuItem} />
      <MenuItemList menuItems={menuItems} ingredients={ingredients} stations={stations} />

      <DealForm onCreate={handleCreateDeal} />
      <DealList deals={deals} menuItems={menuItems} />
    </div>
  )
}

export default MenuManagementScreen
