import { useState, useEffect } from 'react';

const styles = {
  panel: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', marginBottom: 20 },
  heading: { fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 },
  grid: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, color: '#6b7280', fontWeight: 600 },
  input: { padding: '10px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#22262b', background: '#fafafa', minWidth: 150 },
  inputWide: { padding: '10px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#22262b', background: '#fafafa', minWidth: 220 },
  button: { padding: '10px 18px', fontSize: 14, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' },
  cancel: { padding: '10px 14px', fontSize: 14, fontWeight: 600, background: 'none', color: '#6b7280', border: 'none', borderRadius: 8, cursor: 'pointer' },
  hint: { fontSize: 12, color: '#9ca3af', marginTop: 10, lineHeight: 1.5 },
};

const BLANK = {
  name: '',
  printer_type: 'kitchen',
  connection_type: 'lan',
  ip_address: '',
  port: 9100,
  paper_width: 32,
};

function StationForm({ editing, onSubmit, onCancelEdit }) {
  const [form, setForm] = useState(BLANK);

  // Prefill when an existing station is selected for editing, and reset back to
  // blank when that edit is cancelled.
  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name ?? '',
        printer_type: editing.printer_type ?? 'kitchen',
        connection_type: editing.connection_type ?? 'lan',
        ip_address: editing.ip_address ?? '',
        port: editing.port ?? 9100,
        paper_width: editing.paper_width ?? 32,
      });
    } else {
      setForm(BLANK);
    }
  }, [editing]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;

    await onSubmit({
      name: form.name.trim(),
      printer_type: form.printer_type,
      connection_type: form.connection_type,
      // Empty string would be stored as a blank IP and look configured while not
      // being reachable — null is what the driver treats as "not set up yet".
      ip_address: form.ip_address.trim() || null,
      port: Number(form.port) || 9100,
      paper_width: Number(form.paper_width) || 32,
    });

    if (!editing) setForm(BLANK);
  }

  return (
    <div style={styles.panel}>
      <div style={styles.heading}>{editing ? `Edit station — ${editing.name}` : 'Add a printer station'}</div>
      <form onSubmit={handleSubmit} style={styles.grid}>
        <div style={styles.field}>
          <label style={styles.label}>Name</label>
          <input
            style={styles.inputWide} placeholder="e.g. Grill, Fryer, Counter"
            value={form.name} onChange={(e) => set('name', e.target.value)}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Printer role</label>
          <select style={styles.input} value={form.printer_type} onChange={(e) => set('printer_type', e.target.value)}>
            <option value="kitchen">Kitchen (routed by station)</option>
            <option value="receipt">Receipt (customer)</option>
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Connection</label>
          <select style={styles.input} value={form.connection_type} onChange={(e) => set('connection_type', e.target.value)}>
            <option value="lan">WiFi / network</option>
            <option value="usb">USB (not supported yet)</option>
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>IP address</label>
          <input
            style={styles.input} placeholder="192.168.1.50"
            value={form.ip_address} onChange={(e) => set('ip_address', e.target.value)}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Port</label>
          <input
            style={{ ...styles.input, minWidth: 90 }} type="number"
            value={form.port} onChange={(e) => set('port', e.target.value)}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Paper width</label>
          <select style={styles.input} value={form.paper_width} onChange={(e) => set('paper_width', e.target.value)}>
            <option value={32}>58mm (32 chars)</option>
            <option value={48}>80mm (48 chars)</option>
          </select>
        </div>

        <button type="submit" style={styles.button}>{editing ? 'Save changes' : 'Add station'}</button>
        {editing && <button type="button" style={styles.cancel} onClick={onCancelEdit}>Cancel</button>}
      </form>

      <div style={styles.hint}>
        Leave the IP blank until the printer is physically installed — tickets are then rendered and
        logged instead of sent, so the rest of the system stays usable. Use <strong>Test print</strong> after
        filling it in to confirm the printer is reachable.
      </div>
    </div>
  );
}

export default StationForm;
