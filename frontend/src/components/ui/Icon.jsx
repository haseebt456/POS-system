import { cx } from '../../lib/cx';

// Hand-rolled inline SVG rather than an icon package.
//
// The sidebar needs about fourteen glyphs and the whole app perhaps twenty-five. An icon
// dependency for that is ~40kB of tree-shaken JS plus its own visual language — stroke
// widths and corner radii that would not match the tokens. These are drawn on a 24px grid
// with a 1.75 stroke so they line up with the 13-14px type they sit beside.
//
// Every path is stroke-only and inherits `currentColor`, so an icon takes the colour of
// whatever it is inside — that is what makes the active nav pill work without a second
// rule. `fill="none"` matters: SVG defaults to a black fill, which would turn every
// outline into a solid blob.
const PATHS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),

  // A receipt, not a shopping cart. The destination is a till that prints a bill, and a
  // receipt is the thing the operator is actually producing.
  pos: (
    <>
      <path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2v-19z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),

  history: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5V12l3.5 2.5" />
    </>
  ),

  stock: (
    <>
      <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" />
      <path d="M3 7l9 4 9-4" />
      <path d="M12 21V11" />
    </>
  ),

  movements: (
    <>
      <path d="M7 20V4M3.5 7.5L7 4l3.5 3.5" />
      <path d="M17 4v16M13.5 16.5L17 20l3.5-3.5" />
    </>
  ),

  truck: (
    <>
      <path d="M3 16.5V6.5h11v10" />
      <path d="M14 10h4l3 3v3.5h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),

  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6" />
      <path d="M17.5 14.4A6.5 6.5 0 0 1 21.5 20" />
    </>
  ),

  // A banknote. "Payments & Balances" is about money owed, not about a wallet object.
  money: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="3" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 10v4M18 10v4" />
    </>
  ),

  utensils: (
    <>
      <path d="M6 2.5v5.5a2 2 0 0 0 4 0V2.5" />
      <path d="M8 10v11.5" />
      <path d="M17 2.5c1.6 1.6 2.2 3.6 2.2 6 0 2-.6 3-2.2 3.6V21.5" />
    </>
  ),

  tag: (
    <>
      <path d="M3.5 11.5V4.5a1 1 0 0 1 1-1h7l9 9-8 8-9-9z" />
      <circle cx="7.75" cy="7.75" r="1.4" />
    </>
  ),

  percent: (
    <>
      <path d="M19 5L5 19" />
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </>
  ),

  reports: <path d="M4 20v-6M9.5 20V4.5M15 20v-9M20.5 20V8" />,

  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2v3M12 19v3M22 12h-3M5 12H2" />
      <path d="M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7L5.6 5.6" />
    </>
  ),

  printer: (
    <>
      <path d="M7 9V3h10v6" />
      <rect x="3" y="9" width="18" height="8" rx="2" />
      <path d="M7 14h10v7H7z" />
    </>
  ),

  logout: (
    <>
      <path d="M14.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5" />
      <path d="M9 8l-4 4 4 4" />
      <path d="M5 12h10" />
    </>
  ),

  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20.5 20.5l-4.7-4.7" />
    </>
  ),

  close: <path d="M6 6l12 12M18 6L6 18" />,

  backspace: (
    <>
      <path d="M21 5.5H9.2L3 12l6.2 6.5H21a1 1 0 0 0 1-1v-11a1 1 0 0 0-1-1z" />
      <path d="M17 9.5l-5 5M12 9.5l5 5" />
    </>
  ),

  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
};

export const ICON_NAMES = Object.keys(PATHS);

// `label` is what makes an icon-only button accessible. When it is given the SVG becomes
// aria-hidden and the label becomes a title, because an icon inside a labelled button is
// decoration — announcing it twice is worse than not announcing it.
function Icon({ name, size = 20, label, className, ...rest }) {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      className={cx(className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      {...rest}
    >
      {label && <title>{label}</title>}
      {path}
    </svg>
  );
}

export default Icon;
