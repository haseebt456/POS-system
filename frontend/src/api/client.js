const ORIGIN = 'http://localhost:3001';
const BASE_URL = `${ORIGIN}/api`;

export function uploadUrl(imagePath) {
  if (!imagePath) return null;
  return `${ORIGIN}/uploads/${imagePath}`;
}

// The session token lives in sessionStorage, not localStorage: a token there survives
// closing the app, which on a till that gets handed between staff is the wrong default.
// Closing the window signs you out.
const TOKEN_KEY = 'pos.token';

// sessionStorage throws rather than returning null in a few situations — private windows,
// blocked site data, some embedded contexts. A storage failure must not take the app down
// with it, so every access is guarded and an unreadable token simply means "signed out".
export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to do — the in-memory session still works for this page load */
  }
}

// Called when the server rejects a token we thought was good. The auth provider subscribes
// so it can drop straight to the login screen. Without this a revoked session shows up as
// every screen in the app failing at once, with no hint that the fix is to sign in again.
let unauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

async function request(method, path, body) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  // A failed sign-in is the one 401 that is not an expired session — it is the answer to a
  // question, and tearing down the login screen in response would clear the error message
  // the user needs to read.
  if (res.status === 401 && path !== '/auth/login') {
    setToken(null);
    if (unauthorizedHandler) unauthorizedHandler();
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.error || `Request failed (${res.status})`);
    // Carried so a caller can tell 403 (not permitted) from 404 (not there) without
    // matching on the message text.
    err.status = res.status;
    throw err;
  }

  return res.json();
}

export const authApi = {
  // Public — the PIN pad has to know whose names to show before anyone has signed in.
  operators: () => request('GET', '/auth/operators'),
  loginWithPassword: (username, password) => request('POST', '/auth/login', { username, password }),
  loginWithPin: (userId, pin) => request('POST', '/auth/login', { user_id: userId, pin }),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/auth/me'),
};

export const stationsApi = {
  getAll: () => request('GET', '/stations'),
  getById: (id) => request('GET', `/stations/${id}`),
  create: (data) => request('POST', '/stations', data),
  update: (id, data) => request('PUT', `/stations/${id}`, data),
  deactivate: (id) => request('DELETE', `/stations/${id}`),
  testPrint: (id) => request('POST', `/stations/${id}/test-print`),
};
export const ingredientsApi = {
  create: (data) => request('POST', '/ingredients', data),
  getAll: () => request('GET', '/ingredients'),
  getLowStock: () => request('GET', '/ingredients/low-stock'),
  update: (id, data) => request('PUT', `/ingredients/${id}`, data),
  setStock: (id, qty) => request('PUT', `/ingredients/${id}/stock`, { qty }),
  reconcile: (entries) => request('POST', '/ingredients/reconcile', { entries }),
  deactivate: (id) => request('DELETE', `/ingredients/${id}`),
};

export const menuItemsApi = {
  getAll: () => request('GET', '/menu-items'),
  getById: (id) => request('GET', `/menu-items/${id}`),
  create: (data) => request('POST', '/menu-items', data),
  update: (id, data) => request('PUT', `/menu-items/${id}`, data),
  uploadImage: (id, data_url) => request('POST', `/menu-items/${id}/image`, { data_url }),
  deactivate: (id) => request('DELETE', `/menu-items/${id}`),
  getRecipe: (id) => request('GET', `/menu-items/${id}/recipe`),
  addRecipeItem: (id, ingredient_id, quantity_required) =>
    request('POST', `/menu-items/${id}/recipe`, { ingredient_id, quantity_required }),
};

export const categoriesApi = {
  getAll: (all = false) => request('GET', `/categories${all ? '?all=1' : ''}`),
  create: (data) => request('POST', '/categories', data),
  update: (id, data) => request('PUT', `/categories/${id}`, data),
  reorder: (ids) => request('PUT', '/categories/reorder', { ids }),
  deactivate: (id) => request('DELETE', `/categories/${id}`),
};

export const dealsApi = {
  getAll: () => request('GET', '/deals'),
  getById: (id) => request('GET', `/deals/${id}`),
  create: (data) => request('POST', '/deals', data),
  addItem: (id, menu_item_id, quantity) =>
    request('POST', `/deals/${id}/items`, { menu_item_id, quantity }),
};

// Builds "?a=1&b=2", dropping anything empty. A filter that was cleared in the UI should
// leave the URL as if it had never been set — sending `status=` would ask the server for
// orders whose status is the empty string, which is none of them.
function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

export const ordersApi = {
  // `hold: true` parks the order as a cart: real lines and a real total, but nothing paid for,
  // printed, or taken off the shelf.
  create: (data) => request('POST', '/orders', data),
  getById: (id) => request('GET', `/orders/${id}`),
  getPending: () => request('GET', '/orders/pending'),
  // Carts set aside. The server narrows this to the session's own operator unless they are an
  // admin, the same rule the history follows.
  getHeld: () => request('GET', '/orders/held'),
  // Rewrites an order that is still open — the recall path. Same body as create: send it without
  // `hold` to release the order for payment and printing, with `hold: true` to park it again.
  save: (id, data) => request('PUT', `/orders/${id}`, data),
  // Only ever succeeds on a held order; the server refuses anything that is a record of a sale.
  discard: (id) => request('DELETE', `/orders/${id}`),
  // filters: { from, to, status, payment_method_id, created_by, search, limit, offset }
  // The server narrows an operator's history to their own orders whatever this asks for.
  list: (filters) => request('GET', `/orders${query(filters)}`),
  complete: (id) => request('PUT', `/orders/${id}/complete`),
  print: (id, force = false) => request('POST', `/orders/${id}/print`, { force }),
  getPrintStatus: (id) => request('GET', `/orders/${id}/print-status`),
  preview: (id) => request('GET', `/orders/${id}/preview`),
};

// Cash / Card / JazzCash / Easypaisa. Read by the till when taking payment and by the order
// history's filter. `all` includes methods since deactivated, which an old order still
// needs to be findable by.
export const paymentMethodsApi = {
  getAll: (all = false) => request('GET', `/payment-methods${all ? '?all=1' : ''}`),
};

// The POS settings the till acts on. Read by both roles: `discount_cap_cents` is what THIS
// user may take off an order (null for an admin, who is not capped), and the server enforces
// the same number on POST /orders — so this is here to grey the field out, not to be trusted.
export const posConfigApi = {
  get: () => request('GET', '/pos-config'),
};

// The ledger behind every stock number. Read-only: the writes happen inside the order,
// purchase and stock-count paths that cause them, so there is nothing to post here.
// filters: { ingredient_id, reason, ref_type, from, to, limit, offset }
export const stockMovementsApi = {
  list: (filters) => request('GET', `/stock-movements${query(filters)}`),
  reasons: () => request('GET', '/stock-movements/reasons'),
};
export const purchasesApi = {
  create: (data) => request('POST', '/purchases', data),
  getAll: () => request('GET', '/purchases'),
  getById: (id) => request('GET', `/purchases/${id}`),
  getForSupplier: (supplierId) => request('GET', `/purchases/supplier/${supplierId}`),
  getPaymentsForSupplier: (supplierId) => request('GET', `/purchases/supplier/${supplierId}/payments`),
};
export const suppliersApi = {
  getAll: () => request('GET', '/suppliers'),
  getById: (id) => request('GET', `/suppliers/${id}`),
  create: (data) => request('POST', '/suppliers', data),
  update: (id, data) => request('PUT', `/suppliers/${id}`, data),
  recordPayment: (supplierId, amount_cents) =>
    request('POST', `/purchases/supplier/${supplierId}/payments`, { amount_cents }),
};
