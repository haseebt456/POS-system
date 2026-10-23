// The one money formatter for the frontend.
//
// This is a deliberate copy of `formatMoney` in backend/printing/layout.js — same
// algorithm, same output. The total on the till and the total printed on the customer's
// receipt have to agree character-for-character, and the surest way to keep two
// implementations in step is to have them be the same implementation.
//
// Deliberately NOT toLocaleString(). That follows the machine's locale, so on a shop PC
// set to Urdu it returns Arabic-Indic digits ("١٬٠٠٠"). On the print side that got
// sanitised to "Rs. ????"; on screen it would just look like a different number to the
// operator than to the customer. The app had two different locale-dependent money
// formatters in it before this.
//
// Paisa are shown only when they exist: every price in this shop is whole rupees, and
// "Rs. 300" reads better than "Rs. 300.00" — especially in a 32-column kitchen ticket.
export function formatMoney(cents) {
  const value = cents ?? 0;
  const abs = Math.abs(value);
  const rupees = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const paisa = abs % 100;
  const fraction = paisa === 0 ? '' : `.${String(paisa).padStart(2, '0')}`;
  return `Rs. ${value < 0 ? '-' : ''}${rupees}${fraction}`;
}
