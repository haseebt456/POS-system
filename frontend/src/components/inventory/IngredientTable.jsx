import { Table, Th, Td, Badge, Button } from '../ui';
import styles from './IngredientTable.module.css';

function IngredientTable({ ingredients, lowStockIds, loading, onEdit, onDeactivate }) {
  if (loading) return <p className="empty">Loading…</p>;
  if (ingredients.length === 0) {
    return <p className="empty">No ingredients yet. Add your first one above.</p>;
  }

  return (
    <Table>
      <thead>
        <tr>
          <Th>Name</Th>
          <Th align="right">Stock</Th>
          <Th>Unit</Th>
          <Th>Tracked</Th>
          <Th align="right" />
        </tr>
      </thead>
      <tbody>
        {ingredients.map((ing) => {
          const isLow = lowStockIds.has(ing.id);
          return (
            // A token used inline. Inline styles can't do :hover, but they can still read a
            // custom property — which is what makes a genuine one-off like this row tint
            // cheap without inventing a component or a utility class for it.
            <tr key={ing.id} style={isLow ? { background: 'var(--warn-bg-subtle)' } : undefined}>
              <Td>{ing.name}</Td>
              <Td align="right">
                <span className={styles.qty}>{ing.stock_qty}</span>
                {isLow && <Badge tone="warn">Low stock</Badge>}
              </Td>
              <Td>{ing.unit}</Td>
              <Td>{ing.is_trackable ? 'Yes' : 'No'}</Td>
              <Td align="right">
                <div className={styles.actions}>
                  <Button size="sm" variant="ghost" onClick={() => onEdit(ing)}>Edit</Button>
                  <Button
                    size="sm"
                    variant="dangerGhost"
                    onClick={() => onDeactivate(ing.id, ing.name)}
                  >
                    Remove
                  </Button>
                </div>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

export default IngredientTable;
