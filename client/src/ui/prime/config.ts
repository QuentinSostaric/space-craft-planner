import type { APIOptions } from 'primereact/api';

/**
 * PrimeReact's default overlay z-index (1000) sits *below* our AppBar
 * (`zIndex.drawer + 1` = 1201, see the scale in `ui/system.tsx`), so panels
 * portaled to `document.body` — the dropdown list, autocomplete suggestions,
 * menus — rendered behind the sticky header and came out visually sliced.
 * Re-anchor Prime's layers onto our own scale so overlays clear the header
 * while staying under modals, and modals stay under snackbars/tooltips.
 */
export const primeConfig: Partial<APIOptions> = {
  ripple: false,
  zIndex: {
    overlay: 1250,
    menu: 1250,
    modal: 1300,
    tooltip: 1500,
  },
};
