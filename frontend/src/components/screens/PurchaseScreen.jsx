import { useState, useEffect, Fragment } from 'react'
import { purchasesApi, suppliersApi, ingredientsApi } from '../../api/client'
import PurchaseForm from '../Purchase/PurchaseForm'
import { formatMoney } from '../../lib/money'
import { formatDate } from '../../lib/format'
import { Panel, PageHeader, Banner, Table, Th, Td, Badge, Button, Field, Input } from '../ui'
import styles from './PurchaseScreen.module.css'

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

  // Wrapped in a <form> by the caller so Enter submits. As a bare <div> it did nothing,
  // which is the one place in the app where the obvious keystroke was dead.
  async function handleRecordPayment(e) {
    e.preventDefault()
    const amount = Number(paymentAmount)
    if (!amount || amount <= 0) return
    setError(null)
    try {
      await suppliersApi.recordPayment(payingSupplierId, Math.round(amount * 100))
      setPayingSupplierId(null)
      setPaymentAmount('')
      await loadAll()
    } catch (err) {
      setError('Could not record payment: ' + err.message)
    }
  }

  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name ?? `#${id}`;

  if (loading) return <div className="page">Loading…</div>

  return (
    <div className="page stack">
      <PageHeader title="Purchases &amp; Suppliers" />

      {error && <Banner tone="danger">{error}</Banner>}

      {suppliers.length === 0 && (
        <Banner tone="warn">
          No suppliers exist yet — add one below before recording a purchase (a purchase can't be
          recorded without one).
        </Banner>
      )}

      {/* --- Suppliers + balances --- */}
      <Panel title="Suppliers">
        {suppliers.length === 0 ? (
          <p className="empty">No suppliers yet. Add your first one below.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Contact</Th>
                <Th align="right">Balance owed</Th>
                <Th align="right" />
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <Td>{s.name}</Td>
                  <Td>{s.contact_number || '—'}</Td>
                  <Td align="right">
                    <span className={styles.amount}>
                      {s.balance_owed_cents > 0 ? (
                        <span className={styles.balance}>
                          {formatMoney(s.balance_owed_cents)}
                          <Badge tone="warn">Owed</Badge>
                        </span>
                      ) : (
                        <span className={styles.settled}>
                          {s.balance_owed_cents < 0
                            ? `${formatMoney(-s.balance_owed_cents)} credit`
                            : 'Settled'}
                        </span>
                      )}
                    </span>
                  </Td>
                  <Td align="right">
                    <div className={styles.actions}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setPayingSupplierId(s.id); setPaymentAmount(''); }}
                      >
                        Record payment
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {payingSupplierId !== null && (
          <form className={styles.paymentRow} onSubmit={handleRecordPayment}>
            <span className={styles.paymentLabel}>
              Payment to <strong>{supplierName(payingSupplierId)}</strong>
            </span>
            <Field label="Amount (Rs.)" className={styles.amountField}>
              <Input
                type="number" min="0" step="0.01" autoFocus
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="primary">Save payment</Button>
            <Button variant="ghost" onClick={() => { setPayingSupplierId(null); setPaymentAmount(''); }}>
              Cancel
            </Button>
          </form>
        )}

        <form className={styles.supplierForm} onSubmit={handleCreateSupplier}>
          <Field label="Name">
            <Input
              placeholder="New supplier name" required
              value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)}
            />
          </Field>
          <Field label="Contact number">
            <Input
              placeholder="Optional"
              value={newSupplierContact} onChange={(e) => setNewSupplierContact(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="primary">Add supplier</Button>
        </form>
      </Panel>

      {/* --- Record a delivery --- */}
      {suppliers.length > 0 && ingredients.length > 0 && (
        <PurchaseForm
          suppliers={suppliers}
          ingredients={ingredients}
          onCreate={handleCreatePurchase}
        />
      )}

      {suppliers.length > 0 && ingredients.length === 0 && (
        <Panel>
          <p className="empty">Add some ingredients first — a purchase has nothing to receive until then.</p>
        </Panel>
      )}

      {/* --- History --- */}
      <Panel title="Recent purchases">
        {purchases.length === 0 ? (
          <p className="empty">No purchases recorded yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Supplier</Th>
                <Th align="right">Total</Th>
                <Th align="right">Paid</Th>
                <Th align="right" />
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => {
                const items = purchaseDetails[p.id]
                return (
                  <Fragment key={p.id}>
                    <tr>
                      <Td>{formatDate(p.purchase_date)}</Td>
                      <Td>{supplierName(p.supplier_id)}</Td>
                      <Td align="right">{formatMoney(p.total_amount_cents)}</Td>
                      <Td align="right">{formatMoney(p.amount_paid_cents)}</Td>
                      <Td align="right">
                        <div className={styles.actions}>
                          <Button size="sm" variant="ghost" onClick={() => toggleDetails(p.id)}>
                            {items ? 'Hide items' : 'View items'}
                          </Button>
                        </div>
                      </Td>
                    </tr>
                    {items && (
                      <tr>
                        <Td colSpan={5}>
                          <div className={styles.subItems}>
                            {items.map((it) => (
                              <div key={it.id}>
                                {it.quantity} {it.unit} × {it.ingredient_name} @ {formatMoney(it.unit_cost_cents)}
                              </div>
                            ))}
                          </div>
                        </Td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  )
}

export default PurchaseScreen
