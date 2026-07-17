# Responsive Canvas Contract

Tenant layout-width responsiveness must be expressed against the named
`site-frame` container.

```css
body,
.rt-canvas {
  container-type: inline-size;
  container-name: site-frame;
  contain: layout;
}
```

Use threshold-preserving Tailwind variants:

```html
<section class="@min-[48rem]/site-frame:flex-row">
```

Do not blindly replace `md:` with `@md/site-frame:`. Tailwind's container
`@md` threshold is `28rem`; viewport `md` is `48rem`.

Keep true browser/device behavior as media queries: `print`,
`prefers-reduced-motion`, `prefers-color-scheme`, `forced-colors`, `hover`,
`pointer`, resolution, color gamut, orientation, safe areas, and viewport-height
app-shell work.

Width-dependent JS should observe the frame or component with `ResizeObserver`.
`window.innerWidth`, width-based `matchMedia`, `<picture media>`, and inline-axis
viewport units require an explicit reviewed exception.
