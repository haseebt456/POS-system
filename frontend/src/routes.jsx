import { matchPath } from 'react-router-dom';
import InventoryScreen from './components/screens/InventoryScreen';
import MenuManagementScreen from './components/screens/MenuManagementScreen';
import OrderHistoryScreen from './components/screens/OrderHistoryScreen';
import Placeholder from './components/screens/Placeholder';
import PurchaseScreen from './components/screens/PurchaseScreen';
import SalesScreen from './components/screens/SalesScreen';
import StationsScreen from './components/screens/StationsScreen';
import StockMovementsScreen from './components/screens/StockMovementsScreen';

// The single definition of what the app contains.
//
// Both the sidebar and the router are generated from this list, which is the whole point:
// with two lists, a screen can be listed in the nav but missing a route (a dead link), or
// routed but never listed (unreachable except by typing a URL). Neither failure is
// possible when there is one list.
//
// `roles` gates the nav item AND the route. The route half matters more — the brief is
// explicit that hiding a button is not authorization, so the backend enforces this too
// (middleware/auth.js); this guard only stops an operator reaching a screen that would
// then 403 on every request.

export const ADMIN = 'admin';
export const OPERATOR = 'operator';
const BOTH = [ADMIN, OPERATOR];

// The nav is a tree of groups, and only the leaves are routes. A group is a heading, not a
// destination — which is why `POS` has no path of its own.
//
// A group whose single child has the same name (Dashboard, Reports, Staff Management) is
// rendered by the sidebar as one plain item with no redundant heading above it.
//
// ---
// Several leaves currently point at one screen because that screen already contains all
// their sections: MenuManagementScreen holds items, deals and recipes; PurchaseScreen
// holds purchases, suppliers and payments; StationsScreen is the printer manager. Splitting
// them into one screen per route is M6. Pointing them at the real screen rather than a
// placeholder means every link in the nav does something today — the brief's "preserve
// functionality that already exists" outranks a tidier file tree.
export const NAV = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    // The operator dashboard is not a reduced admin dashboard — it cannot show money at
    // all, so it is a different screen with a different name. See DESIGN.md §6.
    operatorLabel: 'My Day',
    icon: 'dashboard',
    roles: BOTH,
    children: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        operatorLabel: 'My Day',
        path: '/',
        roles: BOTH,
        element: <Placeholder title="Dashboard" milestone="M7" />,
      },
    ],
  },

  {
    id: 'pos',
    label: 'POS',
    icon: 'pos',
    roles: BOTH,
    children: [
      {
        id: 'new-order',
        label: 'New Order',
        path: '/pos',
        roles: BOTH,
        // The till manages its own internal scrolling — a menu column that scrolls
        // independently of a rail that does not. `fill` hands it the remaining height
        // instead of a scrolling document, which is what keeps Submit Order on screen.
        fill: true,
        element: <SalesScreen />,
      },
      {
        id: 'order-history',
        label: 'Order History',
        path: '/pos/history',
        roles: BOTH,
        element: <OrderHistoryScreen />,
      },
    ],
  },

  {
    id: 'inventory',
    label: 'Inventory',
    icon: 'stock',
    roles: BOTH,
    children: [
      {
        id: 'stock',
        label: 'Stock',
        path: '/inventory/stock',
        roles: BOTH,
        element: <InventoryScreen />,
      },
      {
        // Admin-only, matching the plan's operator nav of four entries. The permission matrix
        // lets operators *record* a movement with a reason; it is the review log that is
        // admin-only. Recording happens through the stock count and the till, both of which
        // already work for an operator — see the note in DESIGN.md §6.
        id: 'movements',
        label: 'Stock Movements',
        path: '/inventory/movements',
        roles: [ADMIN],
        element: <StockMovementsScreen />,
      },
    ],
  },

  {
    id: 'purchases',
    label: 'Purchases',
    icon: 'truck',
    roles: [ADMIN],
    children: [
      {
        id: 'purchases',
        label: 'Purchases',
        path: '/purchases',
        roles: [ADMIN],
        element: <PurchaseScreen />,
      },
      {
        id: 'suppliers',
        label: 'Suppliers',
        path: '/purchases/suppliers',
        roles: [ADMIN],
        element: <PurchaseScreen />,
      },
      {
        // Money owed to suppliers. Admin-only by role, and the figures are never sent to
        // an operator session even if the route were reached.
        id: 'balances',
        label: 'Payments & Balances',
        path: '/purchases/balances',
        roles: [ADMIN],
        element: <PurchaseScreen />,
      },
    ],
  },

  {
    id: 'menu',
    label: 'Menu',
    icon: 'utensils',
    roles: [ADMIN],
    children: [
      {
        id: 'menu-items',
        label: 'Menu Items',
        path: '/menu/items',
        roles: [ADMIN],
        element: <MenuManagementScreen />,
      },
      {
        id: 'categories',
        label: 'Categories',
        path: '/menu/categories',
        roles: [ADMIN],
        element: <MenuManagementScreen />,
      },
      {
        id: 'deals',
        label: 'Deals',
        path: '/menu/deals',
        roles: [ADMIN],
        element: <MenuManagementScreen />,
      },
    ],
  },

  {
    id: 'reports',
    label: 'Reports',
    icon: 'reports',
    roles: [ADMIN],
    children: [
      {
        id: 'reports',
        label: 'Reports',
        path: '/reports',
        roles: [ADMIN],
        element: <Placeholder title="Reports" milestone="M7" />,
      },
    ],
  },

  {
    // The brief says to call this "Staff Management" in the nav, not "Users & Roles".
    // Settings → Staff Accounts is the credential view of the same people; this is the
    // people view (contact, attendance, pay). One row in `users` per person, deliberately.
    id: 'staff',
    label: 'Staff Management',
    icon: 'users',
    roles: [ADMIN],
    children: [
      {
        id: 'staff',
        label: 'Staff Management',
        path: '/staff',
        roles: [ADMIN],
        element: <Placeholder title="Staff Management" milestone="M7" />,
      },
    ],
  },

  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    roles: [ADMIN],
    children: [
      {
        id: 'business',
        label: 'Business',
        path: '/settings/business',
        roles: [ADMIN],
        element: <Placeholder title="Business Settings" milestone="M7" />,
      },
      {
        // The old top-level "Printers" tab. The brief is explicit that printer management
        // must not be a primary sidebar item, and it is the only nav change the brief
        // states as a rule rather than a preference.
        id: 'printers',
        label: 'Printers',
        path: '/settings/printers',
        roles: [ADMIN],
        element: <StationsScreen />,
      },
      {
        id: 'staff-accounts',
        label: 'Staff Accounts',
        path: '/settings/users',
        roles: [ADMIN],
        element: <Placeholder title="Staff Accounts" milestone="M7" />,
      },
      {
        id: 'pos-config',
        label: 'POS Configuration',
        path: '/settings/pos',
        roles: [ADMIN],
        element: <Placeholder title="POS Configuration" milestone="M7" />,
      },
      {
        id: 'system',
        label: 'System',
        path: '/settings/system',
        roles: [ADMIN],
        element: <Placeholder title="System" milestone="M7" />,
      },
    ],
  },
];

// --- Derived views ---------------------------------------------------------

// The nav as one role sees it. Groups that lose every child disappear entirely rather
// than rendering as an empty heading — and because invisible is not the same as
// unauthorized, App.jsx builds its route table from this same list. There is no second
// place where "what this role can reach" is written down.
export function navForRole(role) {
  return NAV.map((group) => ({
    ...group,
    children: group.children.filter((child) => child.roles.includes(role)),
  })).filter((group) => group.children.length > 0);
}

// Every leaf, with its roles. Used to build <Route> elements and to answer "may this role
// open this path" in one place.
export function leaves() {
  return NAV.flatMap((group) =>
    group.children.map((child) => ({ ...child, icon: group.icon, groupId: group.id }))
  );
}

// `operatorLabel` is the same destination named differently per role — "My Day" for the
// person at the till, "Dashboard" for the manager. One route, two words.
export function labelFor(item, role) {
  return (role === OPERATOR && item.operatorLabel) || item.label;
}

// Where a role lands after signing in, and where it is sent when it hits a dead end. The
// till is an operator's entire job, so it is the first thing they should see rather than a
// dashboard built for someone else.
export function homeFor(role) {
  return role === OPERATOR ? '/pos' : '/';
}

// "May this role open this path?" — the same question the router answers, asked outside it.
// Used by the login screen to decide whether a deep link is worth honouring.
export function isAllowed(path, role) {
  return leaves().some(
    (leaf) => leaf.roles.includes(role) && matchPath({ path: leaf.path, end: true }, path)
  );
}
