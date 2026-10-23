import { Panel, Field, Input, Select, Button } from '../ui';
import styles from './IngredientForm.module.css';

// Every control here used to be identified by its placeholder alone — there was not a
// single <label> on this screen. A screen reader announced five unnamed boxes, and for a
// sighted operator the placeholder disappeared the moment they started typing, so a
// half-filled form gave no clue which box held what.
function IngredientForm({ form, setForm, fieldErrors, editingId, onSubmit, onCancel }) {
  const isEditing = editingId !== null;

  return (
    <Panel title={isEditing ? `Editing: ${form.name || '…'}` : 'Add ingredient'}>
      <form onSubmit={onSubmit} className={styles.grid}>
        <Field label="Name" error={fieldErrors.name} className={styles.span5}>
          <Input
            placeholder="e.g. Chicken patty"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>

        <Field label="Unit" className={styles.span2}>
          <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="l">l</option>
            <option value="ml">ml</option>
            <option value="pcs">pcs</option>
          </Select>
        </Field>

        <Field
          label={isEditing ? 'Correct stock to' : 'Starting stock'}
          error={fieldErrors.stock_qty}
          className={styles.span3}
        >
          <Input
            type="number" step="any" placeholder="0"
            value={form.stock_qty}
            onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
          />
        </Field>

        <Field label="Low stock alert at" error={fieldErrors.low_stock_threshold} className={styles.span2}>
          <Input
            type="number" step="any" placeholder="0"
            value={form.low_stock_threshold}
            onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
          />
        </Field>

        <div className={styles.footerRow}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={form.is_trackable}
              onChange={(e) => setForm({ ...form, is_trackable: e.target.checked })}
            />
            Track stock automatically
          </label>

          <div className={styles.actions}>
            <Button type="submit" variant="primary">
              {isEditing ? 'Save changes' : 'Add ingredient'}
            </Button>
            {isEditing && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
          </div>
        </div>
      </form>

      {isEditing && (
        <p className={styles.note}>
          Changing the stock figure here overwrites the count directly — use this after a physical
          check, not for routine sales or purchases. Those go through the till and the delivery
          form, which adjust stock by a delta instead.
        </p>
      )}
    </Panel>
  );
}

export default IngredientForm;
