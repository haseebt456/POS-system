import { useState, useEffect, Fragment } from 'react'
import { purchasesApi, suppliersApi, ingredientsApi } from '../../api/client'
import PurchaseForm from '../Purchase/PurchaseForm'

const styles = {
  page: { padding: '24px 20px', maxWidth: 900 },
  h1: { fontSize: 24, fontWeight: 700, margin: '0 0 16px' },
  h2: { fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: '#22262b' },
  banner: { background: '#fdecea', color: '#a32b1f', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, border: '1px solid #f3c8c2' },
  panel: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', marginBottom: 20 },
  table: {
    width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 15,
    background: '#ffffff', borderRadius: 12, overflow: 'hidden',
    border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
  },
  th: {
    textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid #e5e7eb',
    color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase',
    letterSpacing: '0.04em', background: '#fafbfc',
  },
  td: { padding: '13px 16px', borderBottom: '1px solid #f0f1f3' },
  actionsCell: { textAlign: 'right', whiteSpace: 'nowrap' },
  muted: { color: '#8a8a8a', fontSize: 14, padding: '8px 4px' },
  owedBadge: { marginLeft: 10, fontSize: 11, color: '#9a6b00', fontWeight: 700, background: '#fef3c7', padding: '2px 8px', borderRadius: 999 },
  settled: { color: '#6b7280' },
  form: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  input: { flex: '1 1 200px', padding: '10px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#22262b', background: '#fafafa' },
  inputSmall: { flex: '0 1 140px', padding: '10px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#22262b', background: '#fafafa' },
  button: { padding: '10px 18px', fontSize: 14, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' },
  linkButton: { background: 'none', border: 'none', color: '#2563eb', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '4px 8px' },
  subrow: { fontSize: 13, color: '#6b7280', padding: '0 16px 12px' },
};

function rs(cents) {
  return `Rs. ${((cents ?? 0) / 100).toLocaleString()}`;
}

function PurchaseScreen() {
  const [suppliers, setSuppliers] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [purchases, setPurchases] = useState([])
  const [purchaseDetails, setPurchaseDetails] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // New-supplier form state, kept here rather than a child since it's three fields
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierContact, setNewSupplierContact] = useState('')
  const [payingSupplierId, setPayingSupplierId] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [suppliers, ingredients, purchases] = await Promise.all([
        suppliersApi.getAll(),
        ingredientsApi.getAll(),
        purchasesApi.getAll(),
      ])
      setSuppliers(suppliers)
      setIngredients(ingredients)
      setPurchases(purchases)
    } catch (err) {
      setError('Could not load purchase data: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll(); }, [])

  // Line items are fetched per-purchase on demand rather than for every row up
  // front — the list is read-mostly and this keeps one expand cheap.
  async function toggleDetails(purchaseId) {
    if (purchaseDetails[purchaseId]) {
      setPurchaseDetails((prev) => {
        const next = { ...prev }
        delete next[purchaseId]
        return next
      })
      return
    }
    try {
      const full = await purchasesApi.getById(purchaseId)
      setPurchaseDetails((prev) => ({ ...prev, [purchaseId]: full.items }))
    } catch (err) {
      setError('Could not load purchase details: ' + err.message)
    }
  }

  // These handlers clear their inputs only after the write succeeds, so a failed
  // save leaves what the operator typed on screen instead of silently discarding it.
  async function handleCreateSupplier(e) {
    e.preventDefault()
    if (!newSupplierName.trim()) return
    setError(null)
    try {
      await suppliersApi.create({
        name: newSupplierName.trim(),
        contact_number: newSupplierContact.trim() || null,
      })
      setNewSupplierName('')
      setNewSupplierContact('')
      await loadAll()
    } catch (err) {
      setError('Could not add supplier: ' + err.message)
    }
  }

  async function handleCreatePurchase(data) {
    setError(null)
    try {
      await purchasesApi.create(data)
      await loadAll()
    } catch (err) {
      setError('Could not record purchase: ' + err.message)
      throw err // let PurchaseForm keep the operator's input rather than clearing it
    }
  }

  async function handleRecordPayment(supplierId) {
    const amount = Number(paymentAmount)
    if (!amount || amount <= 0) return
    setError(null)
    try {
      await suppliersApi.recordPayment(supplierId, Math.round(amount * 100))
      setPayingSupplierId(null)
      setPaymentAmount('')
      await loadAll()
    } catch (err) {
      setError('Could not record payment: ' + err.message)
    }
  }

  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name ?? `#${id}`;

  if (loading) return <div style={styles.page}>Loading…</div>

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Purchases &amp; Suppliers</h1>

      {error && <div style={styles.banner}>{error}</div>}

      {suppliers.length === 0 && (
        <div style={styles.banner}>
          No suppliers exist yet — add one below before recording a purchase (a purchase can't be recorded without one).
        </div>
      )}

      {/* --- Suppliers + balances --- */}
      <div style={styles.panel}>
        <h2 style={styles.h2}>Suppliers</h2>
        {suppliers.length === 0 ? (
          <p style={styles.muted}>No suppliers yet. Add your first one below.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Contact</th>
                <th style={styles.th}>Balance owed</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td style={styles.td}>{s.name}</td>
                  <td style={styles.td}>{s.contact_number || '—'}</td>
                  <td style={styles.td}>
                    {s.balance_owed_cents > 0
                      ? <>{rs(s.balance_owed_cents)}<span style={styles.owedBadge}>Owed</span></>
                      : <span style={styles.settled}>{s.balance_owed_cents < 0 ? `${rs(-s.balance_owed_cents)} credit` : 'Settled'}</span>}
                  </td>
                  <td style={{ ...styles.td, ...styles.actionsCell }}>
                    <button
                      style={styles.linkButton}
                      onClick={() => { setPayingSupplierId(s.id); setPaymentAmount(''); }}
                    >
                      Record payment
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {payingSupplierId !== null && (
          <div style={{ ...styles.form, marginTop: 14 }}>
            <span style={{ fontSize: 14, color: '#22262b' }}>
              Payment to <strong>{supplierName(payingSupplierId)}</strong>
            </span>
            <input
              style={styles.inputSmall}
              type="number" min="0" step="0.01" placeholder="Amount (Rs.)" autoFocus
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <button style={styles.button} onClick={() => handleRecordPayment(payingSupplierId)}>Save payment</button>
            <button style={styles.linkButton} onClick={() => { setPayingSupplierId(null); setPaymentAmount(''); }}>Cancel</button>
          </div>
        )}

        <form onSubmit={handleCreateSupplier} style={{ ...styles.form, marginTop: 16 }}>
          <input
            style={styles.input} placeholder="New supplier name"
            value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)}
          />
          <input
            style={styles.inputSmall} placeholder="Contact number (optional)"
            value={newSupplierContact} onChange={(e) => setNewSupplierContact(e.target.value)}
          />
          <button type="submit" style={styles.button}>Add supplier</button>
        </form>
      </div>

      {/* --- Record a delivery --- */}
      {suppliers.length > 0 && ingredients.length > 0 && (
        <PurchaseForm
          suppliers={suppliers}
          ingredients={ingredients}
          onCreate={handleCreatePurchase}
        />
      )}

      {suppliers.length > 0 && ingredients.length === 0 && (
        <div style={styles.panel}>
          <p style={styles.muted}>Add some ingredients first — a purchase has nothing to receive until then.</p>
        </div>
      )}

      {/* --- History --- */}
      <div style={styles.panel}>
        <h2 style={styles.h2}>Recent purchases</h2>
        {purchases.length === 0 ? (
          <p style={styles.muted}>No purchases recorded yet.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Supplier</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Paid</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => {
                const items = purchaseDetails[p.id]
                return (
                  <Fragment key={p.id}>
                    <tr>
                      <td style={styles.td}>{new Date(p.purchase_date).toLocaleDateString()}</td>
                      <td style={styles.td}>{supplierName(p.supplier_id)}</td>
                      <td style={styles.td}>{rs(p.total_amount_cents)}</td>
                      <td style={styles.td}>{rs(p.amount_paid_cents)}</td>
                      <td style={{ ...styles.td, ...styles.actionsCell }}>
                        <button style={styles.linkButton} onClick={() => toggleDetails(p.id)}>
                          {items ? 'Hide items' : 'View items'}
                        </button>
                      </td>
                    </tr>
                    {items && (
                      <tr>
                        <td style={styles.subrow} colSpan={5}>
                          {items.map((it) => (
                            <div key={it.id}>
                              {it.quantity} {it.unit} × {it.ingredient_name} @ {rs(it.unit_cost_cents)}
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default PurchaseScreen
