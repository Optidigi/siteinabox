import * as React from "react"
import { Menu, X } from "lucide-react"
import type {
  FooterCompositionColumn,
  FooterCompositionItem,
  FooterCompositionLink,
  MediaRef,
  SiteSettings,
} from "@siteinabox/contracts"
import { cn } from "@siteinabox/ui/lib/utils"
import type { MediaResolver, ResolvedMedia } from "../media"
import { resolveMedia } from "../media"

export type RenderProfileBlockOverride = (args: {
  block: unknown
  index: number
  defaultRender: React.ReactNode
}) => React.ReactNode

export type RenderProfileBlocksOverride = (args: {
  blocks: unknown[]
  defaultRenderBlocks: React.ReactNode[]
}) => React.ReactNode

export type RenderProfileChromeOverride = (args: {
  defaultChrome: React.ReactNode
}) => React.ReactNode

const DEFAULT_NAV_LINKS = [
  { label: "Werkwijze", href: "#werkwijze" },
  { label: "Over", href: "#over" },
  { label: "Wat telt", href: "#wat-telt" },
  { label: "Contact", href: "#contact" },
]

const DEFAULT_BRAND = "Amicare-Zorg"
const DEFAULT_EMAIL = "info@ami-care.nl"
const DEFAULT_TAGLINE = "Jeugdzorg met hart en toewijding."
const DEFAULT_TRADE_NAME = "AMICARE ZORG"
const DEFAULT_KVK_NUMBER = "99968347"
const DEFAULT_ESTABLISHMENT_NUMBER = "000065004922"

function media(value: MediaRef | undefined, mediaResolver?: MediaResolver): ResolvedMedia | null {
  if (!value) return null
  if (!mediaResolver && typeof value === "object" && !Array.isArray(value)) {
    if (value.url) return { src: value.url, alt: value.alt ?? undefined }
    if (value.filename) return { src: `/media/${value.filename}`, alt: value.alt ?? undefined }
  }
  return resolveMedia(value ?? null, mediaResolver)
}

function linkKey(link: FooterCompositionLink, index: number) {
  return `${link.label ?? "link"}-${link.href ?? index}`
}

function itemLabel(item: FooterCompositionItem, fallback: string) {
  return item.label?.trim() || fallback
}

export function AmicareNav({
  settings,
  mediaResolver,
}: {
  settings: SiteSettings
  mediaResolver?: MediaResolver
}) {
  const brand = settings.siteName?.trim() || DEFAULT_BRAND
  const logo = media(settings.chrome?.header?.logo ?? settings.branding?.logo ?? null, mediaResolver)
  const links = settings.navHeader && settings.navHeader.length > 0 ? settings.navHeader : DEFAULT_NAV_LINKS
  const toggleId = "amicare-mobile-menu-toggle"

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-rule bg-bg/80 px-6 py-5 backdrop-blur-lg @min-[48rem]/site-frame:px-12 @min-[64rem]/site-frame:px-20"
      data-amicare-nav
    >
      <a href="#top" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
        {logo ? (
          <>
            <img src={logo.src} alt="" className="h-7 w-auto max-w-40 object-contain" />
            <span className="sr-only">{brand}</span>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-accent" />
            <span className="font-sans text-[13px] font-medium uppercase tracking-[0.18em]">{brand}</span>
          </>
        )}
      </a>

      <div className="hidden items-center gap-8 text-[13px] tracking-[0.04em] @min-[48rem]/site-frame:flex">
        {links.map((link) => {
          const id = link.href.replace(/^#/, "")
          return (
            <a
              key={id}
              href={link.href}
              className="relative text-ink-muted transition-colors hover:text-ink"
              data-amicare-nav-link={id}
            >
              {link.label}
              <span
                aria-hidden="true"
                className="absolute -bottom-1 left-0 right-0 hidden h-[2px] rounded-full bg-accent"
                data-amicare-nav-indicator={id}
              />
            </a>
          )
        })}
      </div>

      <input id={toggleId} className="peer sr-only" type="checkbox" aria-label="Menu openen" />
      <label
        htmlFor={toggleId}
        aria-label="Menu openen"
        className="rounded-full bg-accent/10 p-2 text-ink transition-colors hover:bg-accent/20 @min-[48rem]/site-frame:hidden"
      >
        <Menu className="block peer-checked:hidden" size={20} aria-hidden />
        <X className="hidden peer-checked:block" size={20} aria-hidden />
      </label>

      <div className="absolute right-4 left-4 top-full z-50 mt-2 hidden w-[calc(100%-2rem)] flex-col gap-5 rounded-2xl border border-rule bg-card p-6 shadow-2xl peer-checked:flex @min-[48rem]/site-frame:hidden">
        {links.map((link) => {
          const id = link.href.replace(/^#/, "")
          return (
            <a
              key={id}
              href={link.href}
              className="text-[15px] tracking-[0.04em] text-ink-muted"
              data-amicare-nav-link={id}
            >
              {link.label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}

export function AmicareMaintenanceBanner({ settings }: { settings: SiteSettings }) {
  if (!settings.maintenance?.enabled) return null
  const message = settings.maintenance.message?.trim() || "Deze website is tijdelijk in onderhoud."
  return (
    <aside className="border-b border-rule bg-accent/10 px-6 py-3 text-center text-[13px] font-medium tracking-[0.02em] text-ink @min-[48rem]/site-frame:px-12 @min-[64rem]/site-frame:px-20">
      {message}
    </aside>
  )
}

export function AmicareFooter({
  settings,
  mediaResolver,
}: {
  settings: SiteSettings
  mediaResolver?: MediaResolver
}) {
  const year = new Date().getFullYear()
  const footer = settings.chrome?.footer
  const logo = media(footer?.logo ?? settings.branding?.logo ?? null, mediaResolver)
  const footerBrand = settings.siteName?.trim() || DEFAULT_BRAND
  const footerEmail = settings.contactEmail?.trim() || DEFAULT_EMAIL
  const footerTagline = footer?.tagline?.trim() || DEFAULT_TAGLINE
  const footerTradeName = settings.nap?.legalName?.trim() || DEFAULT_TRADE_NAME
  const footerKvkNumber = settings.nap?.kvkNumber?.trim() || DEFAULT_KVK_NUMBER
  const footerEstablishmentNumber = settings.nap?.establishmentNumber?.trim() || DEFAULT_ESTABLISHMENT_NUMBER
  const copyrightText = footer?.copyright?.trim() || `© ${year} ${footerBrand}`
  const columns = Array.isArray(footer?.columns)
    ? footer.columns.filter((column): column is FooterCompositionColumn => Array.isArray(column?.items))
    : []
  const navLinks = Array.isArray(settings.navFooter)
    ? settings.navFooter.filter((link) => link.label?.trim() && link.href?.trim())
    : []
  const gridClass =
    columns.length === 1
      ? "@min-[48rem]/site-frame:grid-cols-1"
      : columns.length === 2
        ? "@min-[48rem]/site-frame:grid-cols-2"
        : columns.length === 4
          ? "@min-[48rem]/site-frame:grid-cols-4"
          : columns.length === 5
            ? "@min-[48rem]/site-frame:grid-cols-5"
            : columns.length === 6
              ? "@min-[48rem]/site-frame:grid-cols-6"
              : "@min-[48rem]/site-frame:grid-cols-3"

  const brandMark = (
    <div className="flex items-center gap-2.5">
      {logo ? (
        <img src={logo.src} alt="" className="h-8 w-auto max-w-44 object-contain" />
      ) : (
        <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-accent" />
      )}
      <span className="font-sans text-[14px] font-medium uppercase tracking-[0.18em] text-ink">{footerBrand}</span>
    </div>
  )

  const business = (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Bedrijfsgegevens</p>
      <div className="space-y-1.5 text-[13px] leading-[1.6] text-ink-muted">
        <p>Handelsnaam: <span className="text-ink">{footerTradeName}</span></p>
        <p>KVK <span className="text-ink">{footerKvkNumber}</span></p>
        <p>Vestigingsnr. <span className="text-ink">{footerEstablishmentNumber}</span></p>
      </div>
    </div>
  )

  const contact = (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Contact</p>
      <div className="space-y-1.5 text-[13px] leading-[1.6] text-ink-muted">
        <p className="pt-1.5">
          <a href={`mailto:${footerEmail}`} className="text-ink transition-colors hover:text-accent">{footerEmail}</a>
        </p>
      </div>
    </div>
  )

  return (
    <footer className="relative border-t border-rule bg-gradient-to-br from-secondary/20 via-bg to-accent/5 px-6 py-16 @min-[48rem]/site-frame:px-12 @min-[64rem]/site-frame:px-24">
      {columns.length > 0 ? (
        <div className={cn("mx-auto grid max-w-7xl grid-cols-1 gap-12 @min-[48rem]/site-frame:gap-8 @min-[64rem]/site-frame:gap-12", gridClass)}>
          {columns.map((column, columnIndex) => (
            <div key={column.id ?? columnIndex} className="space-y-6">
              {(column.items ?? []).map((item, itemIndex) => (
                <React.Fragment key={item.id ?? itemIndex}>
                  {item.type === "brand" && (
                    <div className="space-y-3">
                      {brandMark}
                      {(item.text?.trim() || footerTagline) && (
                        <p className="max-w-[28ch] font-serif text-[14px] italic leading-[1.5] text-ink-muted">
                          {item.text?.trim() || footerTagline}
                        </p>
                      )}
                    </div>
                  )}
                  {item.type === "business" && business}
                  {item.type === "contact" && contact}
                  {item.type === "text" && item.text?.trim() && (
                    <div className="space-y-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{itemLabel(item, "Info")}</p>
                      <p className="max-w-[28ch] text-[13px] leading-[1.6] text-ink-muted">{item.text.trim()}</p>
                    </div>
                  )}
                  {item.type === "links" && (item.links ?? []).some((link) => link.label?.trim() && link.href?.trim()) && (
                    <div className="space-y-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{itemLabel(item, "Links")}</p>
                      <ul className="space-y-1.5 text-[13px] leading-[1.6] text-ink-muted">
                        {(item.links ?? []).filter((link) => link.label?.trim() && link.href?.trim()).map((link, index) => (
                          <li key={linkKey(link, index)}>
                            <a href={link.href ?? undefined} className="text-ink transition-colors hover:text-accent">{link.label}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {item.type === "navigation" && navLinks.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{itemLabel(item, "Navigatie")}</p>
                      <ul className="space-y-1.5 text-[13px] leading-[1.6] text-ink-muted">
                        {navLinks.map((link, index) => (
                          <li key={linkKey(link, index)}>
                            <a href={link.href} className="text-ink transition-colors hover:text-accent">{link.label}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 @min-[48rem]/site-frame:grid-cols-3 @min-[48rem]/site-frame:gap-8 @min-[64rem]/site-frame:gap-12">
          <div className="space-y-3">
            {brandMark}
            <p className="max-w-[28ch] font-serif text-[14px] italic leading-[1.5] text-ink-muted">{footerTagline}</p>
          </div>
          {business}
          {contact}
        </div>
      )}

      <div className="mx-auto my-8 max-w-7xl border-t border-rule" />
      <p className="mx-auto max-w-7xl text-center text-[12px] tracking-[0.04em] text-ink-muted/70 @min-[48rem]/site-frame:text-left">
        {copyrightText}
      </p>
    </footer>
  )
}

export function AmicareCookieConsent({ enabled, nonce }: { enabled: boolean; nonce?: string }) {
  if (!enabled) return null
  const script = `(() => {
  const preferenceKey = "siab_cookie_consent_v1";
  const banner = document.getElementById("cookie-consent-banner");
  const preferences = document.getElementById("cookie-consent-preferences");
  if (!banner || !preferences) return;
  const readPreference = () => {
    try { return window.localStorage.getItem(preferenceKey); } catch { return null; }
  };
  const writePreference = (value) => {
    try { window.localStorage.setItem(preferenceKey, value); } catch {}
  };
  const showBanner = () => {
    banner.classList.remove("hidden");
    preferences.classList.add("hidden");
  };
  const hideBanner = () => {
    banner.classList.add("hidden");
    preferences.classList.remove("hidden");
  };
  const applyPreference = (value) => {
    if (value === "accepted") {
      window.SIABAnalytics?.grantConsent();
      hideBanner();
      return;
    }
    if (value === "declined") {
      window.SIABAnalytics?.revokeConsent();
      hideBanner();
      return;
    }
    showBanner();
  };
  banner.querySelector("[data-cookie-consent-accept]")?.addEventListener("click", () => {
    writePreference("accepted");
    applyPreference("accepted");
  });
  banner.querySelector("[data-cookie-consent-decline]")?.addEventListener("click", () => {
    writePreference("declined");
    applyPreference("declined");
  });
  preferences.addEventListener("click", showBanner);
  applyPreference(readPreference());
})();`

  return (
    <>
      <div
        id="cookie-consent-banner"
        className="fixed inset-x-4 bottom-4 z-[80] hidden max-w-xl rounded-lg border border-rule bg-card p-4 shadow-2xl @min-[48rem]/site-frame:left-6 @min-[48rem]/site-frame:right-auto @min-[48rem]/site-frame:p-5"
        role="dialog"
        aria-live="polite"
        aria-label="Cookie voorkeuren"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="font-serif text-[22px] leading-tight text-ink">Cookies</p>
            <p className="text-[14px] leading-[1.55] text-ink-muted">
              We gebruiken noodzakelijke cookies voor de website. Met uw toestemming meten we anoniem hoe de website wordt gebruikt.
            </p>
          </div>
          <div className="flex flex-col gap-2 @min-[30rem]/site-frame:flex-row">
            <button type="button" className="amicare-button-primary rounded-md bg-accent px-4 py-2.5 text-[14px] font-medium transition-colors hover:bg-accent/90" data-cookie-consent-accept>
              Accepteren
            </button>
            <button type="button" className="rounded-md border border-rule bg-bg px-4 py-2.5 text-[14px] font-medium text-ink transition-colors hover:bg-secondary/40" data-cookie-consent-decline>
              Weigeren
            </button>
          </div>
        </div>
      </div>
      <button
        id="cookie-consent-preferences"
        type="button"
        className="fixed bottom-4 right-4 z-[70] hidden rounded-md border border-rule bg-card px-3 py-2 text-[12px] font-medium text-ink-muted shadow-lg transition-colors hover:text-ink"
      >
        Cookies
      </button>
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: script }} />
    </>
  )
}

export function AmicareNavBehavior({ nonce }: { nonce?: string }) {
  const script = `(() => {
  const links = Array.from(document.querySelectorAll("[data-amicare-nav-link]"));
  const indicators = Array.from(document.querySelectorAll("[data-amicare-nav-indicator]"));
  if (!links.length) return;
  const ids = ["top", ...links.map((link) => link.getAttribute("data-amicare-nav-link")).filter(Boolean)];
  const setActive = (active) => {
    links.forEach((link) => {
      const isActive = link.getAttribute("data-amicare-nav-link") === active;
      link.classList.toggle("text-ink", isActive);
      link.classList.toggle("font-medium", isActive);
      link.classList.toggle("text-ink-muted", !isActive);
      if (isActive) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
    indicators.forEach((indicator) => {
      indicator.classList.toggle("hidden", indicator.getAttribute("data-amicare-nav-indicator") !== active);
    });
  };
  const onScroll = () => {
    let current = "top";
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= 100) current = id;
    });
    setActive(current);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
})();`
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: script }} />
}
