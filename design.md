# UI/UX Direction and Design System

## 1. Product experience
LifeHub is designed as a mobile-friendly personal workspace that also supports desktop. The visual direction combines a calm, card-based dashboard, compact navigation, rounded surfaces, subtle translucent/glass effects, and dark/light themes. The UI should feel app-like without sacrificing readability or accessible interaction.

Brand naming is currently inconsistent: many source styles and docs use LifeHub, while the manifest and worker messages use DN. Do not rename visible branding globally without a product decision.

## 2. Styling tools
- Styling: plain CSS in `src/index.css` and `src/design-system.css`.
- Theme selection: CSS custom properties controlled by `data-theme="dark"` or `data-theme="light"` on the root HTML element.
- Icons: `lucide-react`.
- Animation: `framer-motion` is available.
- Layout: CSS Flexbox/Grid and responsive media queries.
- No Tailwind, CSS Modules, styled-components, or external component system is declared in the package manifest.

Import order matters: `main.jsx` imports `index.css` first and `design-system.css` second. The latter contains theme and component overrides, sometimes with `!important`; inspect the cascade before editing.

## 3. Design tokens

The following are the explicit base tokens in `src/design-system.css`. Treat these as the primary current token reference, while acknowledging that `index.css` contains a second, legacy/overlapping palette.

### Geometry and typography
| Token | Value |
|---|---:|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 12px |
| `--space-lg` | 16px |
| `--space-xl` | 24px |
| `--space-2xl` | 32px |
| `--radius-sm` | 12px |
| `--radius-md` | 18px |
| `--radius-lg` | 24px |
| `--radius-modal` | 28px |
| `--card-height-sm` | 72px |
| `--card-height-md` | 128px |
| `--card-height-lg` | 140px |
| `--dashboard-cta-height` | 84px |
| `--font-caption` | 12px |
| `--font-body` | 14px |
| `--font-title` | 20px |
| `--font-hero` | 32px |
| `--font-family-ui` | Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif |

### Dark theme palette
| Token | Value |
|---|---|
| `--color-bg` | `#0b1020` |
| `--color-surface` | `#111827` |
| `--color-card` | `#162033` |
| `--color-card-raised` | `#1a2740` |
| `--color-text` | `#edf3ff` |
| `--color-text-muted` | `#a7b3c8` |
| `--color-border` | `rgba(151, 171, 205, .16)` |
| `--color-primary` | `#4f8cff` |
| `--color-success` | `#22c55e` |
| `--color-warning` | `#f59e0b` |
| `--color-danger` | `#ef4444` |
| `--color-glass` | `rgba(17, 24, 39, .82)` |
| `--color-overlay` | `rgba(3, 7, 17, .68)` |

### Light theme palette
| Token | Value |
|---|---|
| `--color-bg` | `#f3f6fb` |
| `--color-surface` | `#ffffff` |
| `--color-card` | `#ffffff` |
| `--color-card-raised` | `#f8faff` |
| `--color-text` | `#17243a` |
| `--color-text-muted` | `#5c6b81` |
| `--color-border` | `rgba(45, 67, 101, .14)` |
| `--color-primary` | `#3477ef` |
| `--color-success` | `#16834a` |
| `--color-warning` | `#a66300` |
| `--color-danger` | `#ce3e48` |
| `--color-glass` | `rgba(255, 255, 255, .82)` |
| `--color-overlay` | `rgba(24, 37, 56, .38)` |

Both themes also define a card shadow token. Prefer the variables over duplicating these values in component CSS.

### Legacy tokens
`src/index.css` also defines `--ink`, `--ink-soft`, `--primary`, `--primary-dark`, `--primary-soft`, `--surface`, `--surface-strong`, `--surface-soft`, `--canvas`, `--canvas-strong`, `--border`, `--border-strong`, `--danger`, and shadow/radius values. Dark theme overrides exist there too. These are still in use by legacy rules; avoid assuming the two token families are interchangeable.

## 4. Layout patterns
- Shared shell: `.lifehub-shell`, `.lifehub-header`, `.lifehub-main`, `.lifehub-sidebar`, `.lifehub-content`.
- Header is sticky/glass-like in base CSS; design-system rules standardize it to a compact 56px header.
- Desktop navigation uses a sidebar, including a collapsed state.
- Mobile layouts use compact/mobile navigation patterns defined in the stylesheet and layout component.
- Dashboard uses cards and summary sections; event screens use event list/detail workspaces; financial screens use forms, lists, and summary cards.
- Common UI primitives include modal dialogs, dropdown selects, date fields, loading skeletons, sort controls, connectivity banner, and toast feedback.

## 5. Interaction patterns
- Use clear primary actions and lower-emphasis secondary actions.
- Keep forms consistent: label, input, validation/error feedback, and a visible submit/cancel path.
- Use confirmation for destructive actions where current UI supports it.
- Show loading skeletons or explicit loading states when data is pending.
- Show user-safe success/error toast messages for actions and app update prompts.
- Keep empty states informative and include an appropriate next action when feasible.
- Avoid layout shifts when labels, priorities, or secondary metadata wrap.
- Preserve swipe actions only as an enhancement; critical actions should remain discoverable without gestures.
- Use explicit user action to refresh into a waiting service-worker update.

## 6. Responsive and accessibility guidance
- Test narrow mobile layouts first, then tablet and desktop widths.
- Prevent horizontal page overflow; allow intentional scrolling only inside a clearly bounded list/control.
- Use touch targets appropriate for mobile and avoid tiny icon-only hit areas.
- Keep text contrast legible in both themes and do not communicate status by color alone.
- Provide labels for form controls, accessible names for icon-only buttons, keyboard operation, and visible focus rings.
- Dialogs should have a clear title, dismissal path, focus behavior, and appropriate semantics.
- Respect reduced-motion preferences for animated interactions where practical.

## 7. Motion and surface treatment
- Prefer short, restrained transitions for color, borders, and position.
- Use blur/translucency for headers and elevated surfaces sparingly so content remains readable.
- Avoid hover-only affordances on touch devices.
- Avoid animations that interfere with form entry or update prompts.

## 8. UI quality checklist
- [ ] Verify dark and light themes.
- [ ] Verify mobile navigation and forms at small viewport sizes.
- [ ] Check long titles/sub-labels, badges, and translated/custom category labels for wrapping.
- [ ] Check focus visibility and keyboard navigation.
- [ ] Check modal height/scroll and background interaction.
- [ ] Check loading, empty, error, and offline-shell states.
- [ ] Confirm card and form styling uses existing tokens where practical.
- [ ] Ensure no console errors or unintended horizontal scrolling.
- [ ] Check that CSS changes work with both stylesheets and their import order.
