import { useState } from 'react';
import { Panel, Field, Input, Button } from '../ui';
import styles from './DealForm.module.css';

function DealForm({ onCreate }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const saved = await onCreate({ name: name.trim(), price_cents: Math.round(Number(price) * 100) });
    if (saved) { setName(''); setPrice(''); }
  }

  return (
    <Panel title="Add deal">
      <form onSubmit={handleSubmit} className={styles.grid}>
        <Field label="Deal name" className={styles.span6}>
          <Input
            placeholder="Burger Combo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>

        <Field
          label="Bundle price (Rs.)"
          className={styles.span3}
          hint="What the customer pays for the set."
        >
          <Input
            type="number" step="0.01" min="0" placeholder="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </Field>

        <div className={styles.actions}>
          <Button type="submit" variant="primary">Add deal</Button>
        </div>
      </form>
    </Panel>
  );
}

export default DealForm;
