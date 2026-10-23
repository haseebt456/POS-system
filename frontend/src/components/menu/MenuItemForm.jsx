import { useEffect, useState } from 'react';
import { Panel, Field, Input, Select, Button } from '../ui';
import styles from './MenuItemForm.module.css';

function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.readAsDataURL(file);
  });
}

function rupees(cents) {
  if (cents == null || cents === '') return '';
  return String(cents / 100);
}

function MenuItemForm({ item, categories, stations, onSave, onCancel }) {
  const editing = Boolean(item);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [stationId, setStationId] = useState('');
  const [description, setDescription] = useState('');
  const [available, setAvailable] = useState(true);
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => {
    setName(item?.name ?? '');
    setCategoryId(item?.category_id ?? '');
    setPrice(rupees(item?.price_cents));
    setCost(rupees(item?.cost_cents));
    setStationId(item?.station_id ?? stations[0]?.id ?? '');
    setDescription(item?.description ?? '');
    setAvailable(item ? item.is_available !== 0 : true);
    setImageFile(null);
  }, [item, stations]);

  const noStations = stations.length === 0;

  async function handleSubmit(e) {
    e.preventDefault();
    const image_data_url = imageFile ? await readDataUrl(imageFile) : null;
    const saved = await onSave({
      name: name.trim(),
      category_id: categoryId === '' ? null : Number(categoryId),
      description: description.trim() || null,
      price_cents: Math.round(Number(price) * 100),
      cost_cents: cost === '' ? null : Math.round(Number(cost) * 100),
      station_id: stationId === '' ? null : Number(stationId),
      is_available: available ? 1 : 0,
      image_data_url,
    });
    if (saved && !editing) {
      setName('');
      setCategoryId('');
      setPrice('');
      setCost('');
      setDescription('');
      setAvailable(true);
      setImageFile(null);
    }
  }

  return (
    <Panel title={editing ? `Edit ${item.name}` : 'Add menu item'}>
      <form onSubmit={handleSubmit} className={styles.grid}>
        <Field label="Item name" className={styles.span4}>
          <Input
            placeholder="Cheeseburger"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>

        <Field label="Category" className={styles.span3}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Price (Rs.)" className={styles.span2}>
          <Input
            type="number" step="0.01" min="0" placeholder="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </Field>

        <Field label="Cost (Rs.)" className={styles.span3} hint="What it costs to make. Operators never see this.">
          <Input
            type="number" step="0.01" min="0" placeholder="Optional"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </Field>

        <Field
          label="Print station"
          className={styles.span3}
          hint={noStations ? 'Add one under Settings → Printers first. Leave blank to inherit the category printer.' : 'Leave blank to inherit the category printer.'}
        >
          <Select
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
          >
            <option value="">Inherit from category</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>

        <Field label="Photo" className={styles.span3}>
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          />
        </Field>

        <Field label="Description" className={styles.span6}>
          <Input
            placeholder="Optional"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
          />
          Available to sell
        </label>

        <div className={styles.actions}>
          {editing && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
          <Button type="submit" variant="primary">{editing ? 'Save item' : 'Add item'}</Button>
        </div>
      </form>
    </Panel>
  );
}

export default MenuItemForm;
