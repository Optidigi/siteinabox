import * as React from "react"
import type { LinkRef } from "@siteinabox/contracts"
import { resolveMedia } from "../media"
import type { FooterVariantProps } from "./Footer"

type FooterBrandProps = Pick<FooterVariantProps, "footer" | "settings" | "mediaResolver">

function FooterBrand({ footer, settings, mediaResolver }: FooterBrandProps) {
  const media = resolveMedia(footer.logo ?? settings.branding?.logo ?? null, mediaResolver)
  return (
    <div className="site-footer-01-brand">
      <a href="/" className="site-footer-01-brand-link" aria-label={`${settings.siteName} home`}>
        {media ? <img src={media.src} alt={media.alt ?? settings.siteName} className="site-footer-01-logo" /> : <span className="site-footer-01-wordmark">{settings.siteName}</span>}
      </a>
      {footer.tagline?.trim() ? <p className="site-footer-01-tagline">{footer.tagline.trim()}</p> : null}
    </div>
  )
}

function FooterNavigation({ links }: { links: LinkRef[] }) {
  if (links.length === 0) return null
  return (
    <nav className="site-footer-01-navigation" aria-label="Footer navigation">
      <ul className="site-footer-01-links">
        {links.map((link, index) => {
          const href = link.href?.trim()
          const label = link.label?.trim()
          if (!href || !label) return null
          return (
            <li key={`${href}-${label}-${index}`}>
              <a href={href} className="site-footer-01-link" {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}>
                {label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function Footer01({ footer, settings, links, mediaResolver }: FooterVariantProps) {
  const copyright = footer.copyright?.trim() || `© ${settings.siteName}`
  return (
    <footer className="site-footer site-footer-01">
      <div className="site-footer-01-inner">
        <div className="site-footer-01-layout">
          <FooterBrand footer={footer} settings={settings} mediaResolver={mediaResolver} />
          <FooterNavigation links={links} />
          <p className="site-footer-01-copyright">{copyright}</p>
        </div>
      </div>
    </footer>
  )
}
