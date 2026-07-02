/** Nonced Vaul bottom-drawer snap CSS for production CSP (`style-src` nonce-only). */
export const VAUL_BOTTOM_SNAP_CSS = `
[data-vaul-drawer] {
  touch-action: auto;
  will-change: transform;
  transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

[data-vaul-drawer][data-vaul-snap-points="true"][data-vaul-drawer-direction="bottom"] {
  transform: translate3d(0, var(--initial-transform, 100%), 0);
}

[data-vaul-drawer][data-vaul-delayed-snap-points="true"][data-vaul-drawer-direction="bottom"] {
  transform: translate3d(0, var(--snap-point-height, 0), 0);
}

[data-vaul-drawer]:not([data-vaul-custom-container="true"])::after {
  content: "";
  position: absolute;
  background: inherit;
  background-color: inherit;
}

[data-vaul-drawer][data-vaul-drawer-direction="bottom"]::after {
  top: 100%;
  bottom: initial;
  left: 0;
  right: 0;
  height: 200%;
}

[data-vaul-handle] {
  display: block;
  position: relative;
  opacity: 0.75;
  margin-left: auto;
  margin-right: auto;
  height: 0.375rem;
  width: 2.5rem;
  border-radius: 9999px;
  touch-action: none;
  cursor: grab;
}

[data-vaul-handle]:active {
  cursor: grabbing;
  opacity: 1;
}

[data-vaul-handle-hitarea] {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: max(100%, 2.75rem);
  height: max(100%, 2.75rem);
  touch-action: none;
}

@media (hover: hover) and (pointer: fine) {
  [data-vaul-drawer] {
    user-select: none;
  }
}
`
