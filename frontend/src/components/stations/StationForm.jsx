import { useState, useEffect } from 'react';
import { Panel, Field, Input, Select, Button } from '../ui';
import styles from './StationForm.module.css';

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
    <Panel title={editing ? `Edit station: ${editing.name}` : 'Add a printer station'}>
      <form onSubmit={handleSubmit} className={styles.grid}>
        <Field label="Name" className={styles.span5}>
          <Input
            placeholder="e.g. Grill, Fryer, Counter"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
        </Field>

        <Field label="Printer role" className={styles.span4}>
          <Select value={form.printer_type} onChange={(e) => set('printer_type', e.target.value)}>
            <option value="kitchen">Kitchen (routed by station)</option>
            <option value="receipt">Receipt (customer)</option>
          </Select>
        </Field>

        <Field label="Connection" className={styles.span3}>
          <Select value={form.connection_type} onChange={(e) => set('connection_type', e.target.value)}>
            <option value="lan">WiFi / network</option>
            <option value="usb">USB (not supported yet)</option>
          </Select>
        </Field>

        <Field label="IP address" className={styles.span4}>
          <Input
            placeholder="192.168.1.50"
            value={form.ip_address}
            onChange={(e) => set('ip_address', e.target.value)}
          />
        </Field>

        <Field label="Port" className={styles.span2}>
          <Input type="number" value={form.port} onChange={(e) => set('port', e.target.value)} />
        </Field>

        <Field label="Paper width" className={styles.span3}>
          <Select value={form.paper_width} onChange={(e) => set('paper_width', e.target.value)}>
            <option value={32}>58mm (32 chars)</option>
            <option value={48}>80mm (48 chars)</option>
          </Select>
        </Field>

        <div className={styles.actions}>
          <Button type="submit" variant="primary">
            {editing ? 'Save changes' : 'Add station'}
          </Button>
          {editing && (
            <Button variant="ghost" onClick={onCancelEdit}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      <p className={styles.hint}>
        Leave the IP blank until the printer is physically installed — tickets are then rendered and
        logged instead of sent, so the rest of the system stays usable. Use <strong>Test print</strong> after
        filling it in to confirm the printer is reachable.
      </p>
    </Panel>
  );
}

export default StationForm;
