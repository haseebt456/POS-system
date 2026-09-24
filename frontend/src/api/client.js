const BASE_URL = 'http://localhost:3001/api';

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const ingredientsApi = {
  create: (data) => request('POST', '/ingredients', data),
  getAll: () => request('GET', '/ingredients'),
  getLowStock: () => request('GET', '/ingredients/low-stock'),
  update: (id, data) => request('PUT', `/ingredients/${id}`, data),
  setStock: (id, qty) => request('PUT', `/ingredients/${id}/stock`, { qty }),
  deactivate: (id) => request('DELETE', `/ingredients/${id}`),
};

export const menuItemsApi = {
  getAll: () => request('GET', '/menu-items'),
  getById: (id) => request('GET', `/menu-items/${id}`),
  create: (data) => request('POST', '/menu-items', data),
  deactivate: (id) => request('DELETE', `/menu-items/${id}`),
  getRecipe: (id) => request('GET', `/menu-items/${id}/recipe`),
  addRecipeItem: (id, ingredient_id, quantity_required) =>
    request('POST', `/menu-items/${id}/recipe`, { ingredient_id, quantity_required }),
};

export const dealsApi = {
  getAll: () => request('GET', '/deals'),
  getById: (id) => request('GET', `/deals/${id}`),
  create: (data) => request('POST', '/deals', data),
  addItem: (id, menu_item_id, quantity) =>
    request('POST', `/deals/${id}/items`, { menu_item_id, quantity }),
};

export const ordersApi = {
  create: (data) => request('POST', '/orders', data),
  getById: (id) => request('GET', `/orders/${id}`),
  getPending: () => request('GET', '/orders/pending'),
  complete: (id) => request('PUT', `/orders/${id}/complete`),
};
