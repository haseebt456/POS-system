// Joins class names, dropping anything falsy.
//
// Worth having because CSS Modules return `undefined` for a class that doesn't exist,
// and `className="undefined"` is a real class name as far as the browser is concerned —
// it fails silently instead of loudly.
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}
