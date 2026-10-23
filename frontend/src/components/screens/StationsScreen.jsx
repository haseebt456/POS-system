import { useState, useEffect } from 'react'
import { stationsApi } from '../../api/client'
import StationForm from '../stations/StationForm'
import StationList from '../stations/StationList'
import { Panel, PageHeader, Banner } from '../ui'

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

  if (loading) return <div className="page">Loading…</div>

  const hasReceiptStation = stations.some((s) => s.printer_type === 'receipt')

  return (
    <div className="page stack">
      <PageHeader title="Printer Stations" />

      {error && <Banner tone="danger">{error}</Banner>}

      {!hasReceiptStation && (
        <Banner tone="info">
          No customer-receipt station yet. Orders will still print to kitchen stations — receipts are
          simply skipped until one is added.
        </Banner>
      )}

      <StationForm
        editing={editing}
        onSubmit={handleSubmit}
        onCancelEdit={() => setEditing(null)}
      />

      <Panel title="Configured stations">
        <StationList
          stations={stations}
          onEdit={setEditing}
          onDeactivate={handleDeactivate}
          onTestPrint={handleTestPrint}
          testingId={testingId}
          testResults={testResults}
        />
      </Panel>
    </div>
  )
}

export default StationsScreen
