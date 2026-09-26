import {useState} from 'react'
import TabNav from './components/layout/TabNav'
import InventoryScreen from './components/screens/InventoryScreen'
import SalesScreen from './components/screens/SalesScreen'
import MenuManagementScreen from './components/screens/MenuManagementScreen'

const TABS = [
   { id: 'inventory', label: 'Inventory' },
   { id: 'sales', label: 'Sales' },
   { id:'menu', label:'Menu'},
]
function App() {
  const [activeTab, setActiveTab] = useState('sales')

  return (
    <div style={{ fontFamily: '"Segoe UI", system-ui, sans-serif', background: '#f6f7f9', minHeight: '100vh' }}>
      <TabNav tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === 'inventory' && <InventoryScreen />}
      {activeTab === 'sales' && <SalesScreen />}
      {activeTab === 'menu' && <MenuManagementScreen />}
    </div>
  )
}

export default App
