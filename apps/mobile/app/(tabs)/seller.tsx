// Render the seller hub directly inside the tab so the tab bar stays visible.
// Sub-screens (product/new, product/[id], sales, etc.) are pushed onto the
// root Stack — they get proper back buttons and return here on dismiss.
export { default } from '@/app/seller/index';
