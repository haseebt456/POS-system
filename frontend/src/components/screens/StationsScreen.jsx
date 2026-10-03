import { useState, useEffect } from 'react'
import { stationsApi } from '../../api/client'
import StationForm from '../stations/StationForm'
import StationList from '../stations/StationList'

const styles = {
  page: { padding: '24px 20px', maxWidth: 900 },
  h1: { fontSize: 24, fontWeight: 700, margin: '0 0 16px' },
  banner: { background: '#fdecea', color: '#a32b1f', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, border: '1px solid #f3c8c2' },
  info: { background: '#eef4ff', color: '#1e40af', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, border: '1px solid #c7d9fb' },
  panel: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', marginBottom: 20 },
  h2: { fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: '#22262b' },
};

function StationsScreen() {
  const [stations, setStations] = useState([])
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [testingId, setTestingId] = useState(null)
  const [testResults, setTestResults] = useState({})

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      setStations(await stationsApi.getAll())
    } catch (err) {
      setError('Could not load stations: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll(); }, [])

  async function handleSubmit(data) {
    setError(null)
    try {
      if (editing) {
        await stationsApi.update(editing.id, data)
        setEditing(null)
      } else {
        await stationsApi.create(data)
      }
      await loadAll()
    } catch (err) {
      setError('Could not save station: ' + err.message)
    }
  }

  async function handleDeactivate(id, name) {
    if (!window.confirm(`Remove "${name}"? Items already routed to it keep their history.`)) return
    setError(null)
    try {
      await stationsApi.deactivate(id)
      if (editing?.id === id) setEditing(null)
      await loadAll()
    } catch (err) {
      setError('Could not remove station: ' + err.message)
    }
  }

  async function handleTestPrint(id) {
    setTestingId(id)
    setError(null)
    try {
      const result = await stationsApi.testPrint(id)
      setTestResults((prev) => ({ ...prev, [id]: result }))
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, error: err.message } }))
    } finally {
      setTestingId(null)
    }
  }

  if (loading) return <div style={styles.page}>Loading…</div>

  const hasReceiptStation = stations.some((s) => s.printer_type === 'receipt');

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Printer Stations</h1>

      {error && <div style={styles.banner}>{error}</div>}

      {!hasReceiptStation && (
        <div style={styles.info}>
          No customer-receipt station yet. Orders will still print to kitchen stations — receipts are
          simply skipped until one is added.
        </div>
      )}

      <StationForm
        editing={editing}
        onSubmit={handleSubmit}
        onCancelEdit={() => setEditing(null)}
      />

      <div style={styles.panel}>
        <h2 style={styles.h2}>Configured stations</h2>
        <StationList
          stations={stations}
          onEdit={setEditing}
          onDeactivate={handleDeactivate}
          onTestPrint={handleTestPrint}
          testingId={testingId}
          testResults={testResults}
        />
      </div>
    </div>
  )
}

export default StationsScreen
