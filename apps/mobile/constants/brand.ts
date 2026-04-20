/**
 * Mall263 brand palette — Zimbabwe flag colours as the primary identity.
 *
 * Flag colours: green #006400 · gold #FFD200 · red #EF3340 · black #000 · white #fff
 *
 * Mapping to UI roles:
 *   primary  = Zimbabwe green  (hero cards, primary buttons, active states)
 *   gold     = Zimbabwe gold   (prices, highlights, badges — bg use only; too light for body text)
 *   red      = Zimbabwe red    (errors, destructive actions)
 *   navy     = retained only for body text and subtle dark labels
 */
export const Brand = {
  // ── Core identity (Zimbabwe flag) ──────────────────────────────────────────
  primary: '#006400',   // Zimbabwe green — hero backgrounds, primary buttons
  gold:    '#FFD200',   // Zimbabwe gold  — price highlights, accent badges
  red:     '#EF3340',   // Zimbabwe red   — errors, danger

  // ── Legacy aliases kept so existing code keeps compiling ───────────────────
  /** @deprecated use Brand.primary */
  blue:   '#006400',   // was #3B9AE1 — now Zimbabwe green
  /** success / positive state green (lighter than primary for inline badges) */
  green:  '#2E7D32',   // Material green-800 — readable on white
  /** accent orange kept for logo-stripe use only */
  orange: '#F7941D',

  // ── Neutral / structural ───────────────────────────────────────────────────
  navy:   '#1B2A4A',   // dark text, labels on white backgrounds
  pageBg: '#f5f5f0',   // warm off-white — removes the blue tint
  card:   '#ffffff',
  border: '#dde3d5',   // faint green-tinted border
  muted:  '#5a6b5a',   // warm grey-green muted text
  text:   '#1a1a1a',   // near-black body text
} as const;

/** Exact Zimbabwe national flag colours — use for decorative stripes / accents. */
export const ZimColors = {
  green:  '#006400',
  yellow: '#FFD200',
  red:    '#EF3340',
  black:  '#000000',
  white:  '#ffffff',
} as const;
