import { useMemo, useState } from 'react';
import { Badge, Input } from '../ui';
import { cx } from '../../lib/cx';
import { formatMoney } from '../../lib/money';
import styles from './MenuGrid.module.css';

// Deals are not categorised, so they are offered as a pseudo-category rather than as a special
// case the filter has to know about. One axis, no branches in the render.
const ALL = '__all__';
const DEALS = '__deals__';

function MenuGrid({ menuItems, deals, onAddMenuItem, onAddDeal }) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState(ALL);

  // Only what the manager has left on sale. Read here rather than trusted to the server because
  // no route writes `is_available` yet — M6 adds PUT /api/menu-items/:id. So today this filters
  // nothing, and is already correct on the day the flag starts moving. Note it is presentation
  // only: POST /orders would still accept an unavailable item. See HANDOFF.md §5.
  const sellable = useMemo(
    () => menuItems.filter((item) => item.is_available !== 0),
    [menuItems]
  );

  const categories = useMemo(() => {
    const names = new Set(
      sellable.map((item) => (item.category ?? '').trim()).filter(Boolean)
    );
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [sellable]);

  const tabs = useMemo(
    () => [
      { id: ALL, label: 'All' },
      ...(deals.length > 0 ? [{ id: DEALS, label: 'Deals' }] : []),
      ...categories.map((name) => ({ id: name, label: name })),
    ],
    [deals.length, categories]
  );

  // The catalogue is reloaded after every order, so a selected category can vanish underneath
  // the operator. Falling back here rather than in an effect keeps the tab row and the grid
  // rendered from one value — an effect would paint a frame of the stale tab first.
  const activeTab = tabs.some((entry) => entry.id === tab) ? tab : ALL;

  const needle = search.trim().toLowerCase();
  const hits = (name) => needle === '' || name.toLowerCase().includes(needle);

  const visibleDeals = deals.filter((deal) => hits(deal.name));
  const visibleItems = sellable.filter(
    (item) =>
      hits(item.name) && (activeTab === ALL || (item.category ?? '').trim() === activeTab)
  );

  // An empty section under a search is noise: the operator already knows what they typed, and a
  // "no deals match" heading above three matching burgers is something to read past.
  const showDeals = (activeTab === ALL || activeTab === DEALS) && (needle === '' || visibleDeals.length > 0);
  const showItems = activeTab !== DEALS && (needle === '' || visibleItems.length > 0);

  return (
    <div className={styles.wrap}>
      {/* Stays at the top of the menu column while the grid scrolls under it — search is
          something the operator reaches for mid-order, not before starting one. */}
      <div className={styles.controls}>
        <Input
          type="search"
          className={styles.search}
          placeholder="Search the menu…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search the menu"
        />

        {tabs.length > 2 && (
          <div className={styles.tabs} role="tablist" aria-label="Menu category">
            {tabs.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={activeTab === entry.id}
                className={cx(styles.tab, activeTab === entry.id && styles.tabActive)}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {showDeals && (
        <section>
          <h2 className={styles.sectionTitle}>Deals</h2>
          <div className={styles.grid}>
            {visibleDeals.length === 0 ? (
              <p className={styles.empty}>No deals yet.</p>
            ) : (
              visibleDeals.map((deal) => (
                <button
                  key={deal.id}
                  type="button"
                  className={cx(styles.card, styles.dealCard)}
                  onClick={() => onAddDeal(deal)}
                >
                  <Badge tone="deal" shape="square" className={styles.badge}>Deal</Badge>
                  <span className={styles.name}>{deal.name}</span>
                  <span className={cx(styles.price, styles.dealPrice)}>
                    {formatMoney(deal.price_cents)}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      )}

      {showItems && (
        <section>
          {/* The heading is only useful when the section sits under another one. On a category
              tab the tab itself is the heading, and repeating it just costs vertical space. */}
          {activeTab === ALL && <h2 className={styles.sectionTitle}>Menu items</h2>}
          <div className={styles.grid}>
            {visibleItems.length === 0 ? (
              <p className={styles.empty}>
                {activeTab === ALL ? 'No menu items yet.' : `Nothing in ${activeTab}.`}
              </p>
            ) : (
              visibleItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.card}
                  onClick={() => onAddMenuItem(item)}
                >
                  <span className={styles.name}>{item.name}</span>
                  <span className={styles.price}>{formatMoney(item.price_cents)}</span>
                </button>
              ))
            )}
          </div>
        </section>
      )}

      {/* Reached only while searching: both sections hide themselves when they have no hits, and
          a blank column reads as a broken screen rather than as "nothing matched". */}
      {!showDeals && !showItems && (
        <p className={styles.empty}>Nothing on the menu matches “{search.trim()}”.</p>
      )}
    </div>
  );
}

export default MenuGrid;
