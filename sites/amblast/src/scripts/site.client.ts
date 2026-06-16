/**
 * Vanilla JS frontend. Loaded once from BaseLayout. Targets the same DOM
 * patterns the curated amb-base.css styles.
 *
 * Responsibilities:
 *   1. Reveal `.amb-invisible` elements (Elementor sets opacity:0 server-side
 *      and the WP frontend JS removes the class on intersection). We use
 *      IntersectionObserver to drop the class as the element scrolls into view.
 *   2. Initialise Swiper on `.amb-info-carousel` and other Elementor swiper widgets
 *      using the inline `data-slider-settings` config.
 *   3. Wire image-comparison sliders (`.amb-compare-overlay` / before-after) to
 *      drag handlers without jQuery.
 *   4. Mobile menu toggle for the HFE nav (`.amb-nav-toggle`).
 *
 * No jQuery. No Elementor frontend bundle.
 */
import Swiper from 'swiper';
import { Autoplay, Pagination, Navigation, EffectFade } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

declare global {
  interface Window {
    __amblastSwipers?: Swiper[];
  }
}

// 1) Reveal amb-invisible -------------------------------------------------
function revealInvisible() {
  const els = document.querySelectorAll<HTMLElement>('.amb-invisible');
  if (!('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.remove('amb-invisible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const settings = el.getAttribute('data-settings');
          let delay = 0;
          if (settings) {
            try {
              const obj = JSON.parse(settings.replace(/&quot;/g, '"'));
              if (typeof obj._animation_delay === 'number') delay = obj._animation_delay;
              else if (typeof obj.animation_delay === 'number') delay = obj.animation_delay;
            } catch {
              /* ignore */
            }
          }
          window.setTimeout(() => {
            el.classList.remove('amb-invisible');
            // Apply the animation class (matches Elementor's runtime behavior)
            // Read _animation key from settings JSON
            try {
              const settings2 = el.getAttribute('data-settings');
              if (settings2) {
                const obj = JSON.parse(settings2.replace(/&quot;/g, '"'));
                const anim = obj._animation || obj.animation;
                if (typeof anim === 'string' && anim && anim !== 'none') {
                  el.classList.add('animated', anim);
                }
              }
            } catch {
              /* ignore */
            }
          }, delay);
          io.unobserve(el);
        }
      }
    },
    { threshold: 0.01, rootMargin: '0px 0px -10% 0px' },
  );
  els.forEach((e) => io.observe(e));
}

// 2) Swiper init ----------------------------------------------------------------
type SliderSettings = {
  effect?: string;
  speed?: number;
  slides_per_view?: number;
  slides_per_view_tablet?: number;
  slides_per_view_mobile?: number;
  space_between?: number;
  space_between_tablet?: number;
  space_between_mobile?: number;
  auto_height?: boolean | string;
  loop?: 'yes' | 'no' | boolean;
  autoplay?: 'yes' | 'no' | boolean;
  autoplay_speed?: number;
  pause_on_interaction?: 'yes' | 'no' | boolean | '';
  pagination?: string;
  show_arrows?: boolean | 'yes';
};

function parseSettings(el: HTMLElement): SliderSettings {
  const raw = el.getAttribute('data-slider-settings') || '{}';
  try {
    return JSON.parse(raw.replace(/&quot;/g, '"'));
  } catch {
    return {};
  }
}

function asBool(v: unknown) {
  if (v === true || v === 'yes') return true;
  if (v === false || v === 'no' || v === '' || v == null) return false;
  return Boolean(v);
}

function initSwipers() {
  const swipers: Swiper[] = [];
  const containers = document.querySelectorAll<HTMLElement>(
    '.amb-info-carousel.swiper, .amb-info-carousel.swiper-container, .swiper.amb-info-carousel',
  );
  containers.forEach((container) => {
    try {
      const settings = parseSettings(container);
      const paginationEl = container.querySelector<HTMLElement>('.swiper-pagination');
      const prevEl = container.querySelector<HTMLElement>('.swiper-button-prev, [class*="swiper-button-prev"]');
      const nextEl = container.querySelector<HTMLElement>('.swiper-button-next, [class*="swiper-button-next"]');
      const modules: any[] = [];
      if (asBool(settings.autoplay)) modules.push(Autoplay);
      if (paginationEl) modules.push(Pagination);
      if (prevEl && nextEl) modules.push(Navigation);
      if (settings.effect === 'fade') modules.push(EffectFade);

      const config: any = {
        modules,
        slidesPerView: settings.slides_per_view ?? 1,
        spaceBetween: settings.space_between ?? 0,
        speed: settings.speed ?? 500,
        autoHeight: asBool(settings.auto_height),
        loop: asBool(settings.loop),
        breakpoints: {
          0: {
            slidesPerView: settings.slides_per_view_mobile ?? settings.slides_per_view ?? 1,
            spaceBetween: settings.space_between_mobile ?? settings.space_between ?? 0,
          },
          768: {
            slidesPerView: settings.slides_per_view_tablet ?? settings.slides_per_view ?? 1,
            spaceBetween: settings.space_between_tablet ?? settings.space_between ?? 0,
          },
          1025: {
            slidesPerView: settings.slides_per_view ?? 1,
            spaceBetween: settings.space_between ?? 0,
          },
        },
      };
      if (settings.effect === 'fade') config.effect = 'fade';
      if (asBool(settings.autoplay)) {
        config.autoplay = {
          delay: settings.autoplay_speed ?? 3000,
          disableOnInteraction: asBool(settings.pause_on_interaction),
        };
      }
      if (paginationEl) {
        config.pagination = { el: paginationEl, clickable: true, type: settings.pagination === 'fraction' ? 'fraction' : 'bullets' };
      }
      if (prevEl && nextEl) {
        config.navigation = { prevEl, nextEl };
      }

      swipers.push(new Swiper(container, config));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[amblast] swiper init failed', err);
    }
  });
  window.__amblastSwipers = swipers;
}

// 3) Image-comparison drag ------------------------------------------------------
function initImageComparison() {
  const wrappers = document.querySelectorAll<HTMLElement>('[data-widget_type="amb-compare.default"]');
  wrappers.forEach((widget) => {
    const beforeEl = widget.querySelector<HTMLElement>('.amb-before');
    const afterEl = widget.querySelector<HTMLElement>('.amb-after');
    const handle = widget.querySelector<HTMLElement>('.amb-compare-handle');
    if (!beforeEl || !afterEl || !handle) return;
    const container = widget.querySelector<HTMLElement>('.amb-compare-wrap, .amb-compare')
      || widget.querySelector<HTMLElement>('div');
    if (!container) return;

    let pct = 50;
    const apply = () => {
      // Show before image on the left, after image on the right of the handle.
      // Clip the LEFT portion of the after image so its right side remains visible.
      afterEl.style.clipPath = `inset(0 0 0 ${pct}%)`;
      afterEl.style.webkitClipPath = `inset(0 0 0 ${pct}%)` as string;
      handle.style.left = `${pct}%`;
    };
    apply();

    let dragging = false;
    const onMove = (clientX: number) => {
      const rect = container.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      pct = (x / rect.width) * 100;
      apply();
    };
    const onPointerDown = (ev: PointerEvent) => {
      dragging = true;
      try { handle.setPointerCapture(ev.pointerId); } catch {}
      onMove(ev.clientX);
      ev.preventDefault();
    };
    const onPointerMove = (ev: PointerEvent) => {
      if (!dragging) return;
      onMove(ev.clientX);
    };
    const onPointerUp = (ev: PointerEvent) => {
      dragging = false;
      try { handle.releasePointerCapture(ev.pointerId); } catch {}
    };
    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    handle.addEventListener('pointercancel', onPointerUp);
    container.addEventListener('click', (ev) => onMove(ev.clientX));
  });
}

// 4) Mobile menu toggle (HFE) ---------------------------------------------------
function initMobileMenu() {
  document.querySelectorAll<HTMLElement>('.amb-nav-toggle').forEach((toggle) => {
    const menu = toggle.parentElement?.querySelector<HTMLElement>('nav.amb-nav-horizontal');
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('tabindex', '0');
    toggle.setAttribute('aria-expanded', 'false');
    // Ensure pointer events reach the toggle even if a parent has 'amb-pointer-none'
    toggle.style.pointerEvents = 'auto';
    toggle.style.cursor = 'pointer';

    const setOpen = (open: boolean) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.classList.toggle('amb-nav-active', open);
      if (menu) menu.classList.toggle('amb-nav-active', open);
      const icon = toggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-bars', !open);
        icon.classList.toggle('fa-times', open);
      }
    };
    const handleActivate = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    };
    // pointerdown covers mouse + touch + pen; fires before click and bypasses
    // the iOS 300ms delay and any click-eating ancestor handlers.
    toggle.addEventListener('pointerdown', handleActivate);
    // Keep click as a fallback for environments without PointerEvent.
    toggle.addEventListener('click', (ev) => {
      // If pointerdown already handled it, the state already toggled — no-op.
      if (ev.detail === 0) return; // synthetic, leave to handleActivate
      ev.preventDefault();
    });
    toggle.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        setOpen(toggle.getAttribute('aria-expanded') !== 'true');
      }
    });

    // Close when an item link is clicked (live behavior — link click closes menu before navigating)
    if (menu) {
      menu.addEventListener('click', (ev) => {
        const t = ev.target as HTMLElement | null;
        if (t && t.closest('a[href]')) {
          // Let the navigation happen; just close the menu
          setOpen(false);
        }
      });
    }
  });
}

// Boot --------------------------------------------------------------------------
function safe(fn: () => void, name: string) {
  try { fn(); } catch (err) { console.warn(`[amblast] ${name} failed`, err); }
}
function boot() {
  safe(revealInvisible, 'revealInvisible');
  safe(initSwipers, 'initSwipers');
  safe(initImageComparison, 'initImageComparison');
  safe(initMobileMenu, 'initMobileMenu');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
