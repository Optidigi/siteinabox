import * as React from "react"

export type SiteIconProps = Omit<React.SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number
}

function SiteIconSvg({ size = 20, className, children, ...props }: SiteIconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      {children}
    </svg>
  )
}

export function SiteArrowRight(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></SiteIconSvg>
}

export function SiteArrowUpRight(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M5 19 19 5" /><path d="M9 5h10v10" /></SiteIconSvg>
}

export function SiteArrowDown(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M12 5v14" /><path d="m6 13 6 6 6-6" /></SiteIconSvg>
}

export function SiteChevronDown(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="m5 9 7 7 7-7" /></SiteIconSvg>
}

export function SiteChevronRight(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="m9 5 7 7-7 7" /></SiteIconSvg>
}

export function SitePlus(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M12 5v14" /><path d="M5 12h14" /></SiteIconSvg>
}

export function SiteMinus(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M5 12h14" /></SiteIconSvg>
}

export function SiteClose(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="m6 6 12 12" /><path d="m18 6-12 12" /></SiteIconSvg>
}

export function SiteMenu(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M4 7h16M4 12h16M4 17h16" /></SiteIconSvg>
}

export function SiteSun(props: SiteIconProps) {
  return <SiteIconSvg {...props}><circle cx="12" cy="12" r="3.5" /><path d="M12 2.75v2M12 19.25v2M21.25 12h-2M4.75 12h-2M18.54 5.46l-1.42 1.42M6.88 17.12l-1.42 1.42M18.54 18.54l-1.42-1.42M6.88 6.88 5.46 5.46" /></SiteIconSvg>
}

export function SiteMoon(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M20.5 14.8A8.5 8.5 0 0 1 9.2 3.5 8.5 8.5 0 1 0 20.5 14.8Z" /></SiteIconSvg>
}

export function SiteCheck(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="m5 12 4.5 4.5L19 7" /></SiteIconSvg>
}

export function SiteCheckCircle(props: SiteIconProps) {
  return <SiteIconSvg {...props}><circle cx="12" cy="12" r="8.5" /><path d="m8 12 2.5 2.5L16 9" /></SiteIconSvg>
}

export function SiteShieldCheck(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M12 3 19 6v5c0 4.2-2.8 7.8-7 10-4.2-2.2-7-5.8-7-10V6l7-3Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></SiteIconSvg>
}

export function SiteClock(props: SiteIconProps) {
  return <SiteIconSvg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></SiteIconSvg>
}

export function SiteSpark(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="m12 3 1.5 6.5L20 12l-6.5 1.5L12 20l-1.5-6.5L4 12l6.5-2.5L12 3Z" /><path d="m19 3 .45 1.55L21 5l-1.55.45L19 7l-.45-1.55L17 5l1.55-.45L19 3Z" /></SiteIconSvg>
}

export function SiteCircleInfo(props: SiteIconProps) {
  return <SiteIconSvg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 10.5v5" /><path d="M12 7.5h.01" /></SiteIconSvg>
}

export function SiteEye(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M3.5 12s3.2-5 8.5-5 8.5 5 8.5 5-3.2 5-8.5 5-8.5-5-8.5-5Z" /><circle cx="12" cy="12" r="2.2" /></SiteIconSvg>
}

export function SiteWrench(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="m14.7 6.3 3-3a5 5 0 0 0 1.4 5.1l-5.3 5.3" /><path d="m10.4 14.6-5.1 5.1a2 2 0 0 1-2.8-2.8l5.1-5.1" /><path d="m8.4 8.4 7.2 7.2" /><path d="M6.2 4.2 4.2 6.2l4 4 2-2-4-4Z" /></SiteIconSvg>
}

export function SiteHouse(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="m3.5 10.5 8.5-7 8.5 7" /><path d="M5.5 9.5v10h13v-10" /><path d="M9.5 19.5v-5h5v5" /></SiteIconSvg>
}

export function SiteBuilding(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M5 20V5.5L14 3v17" /><path d="M14 9h5v11" /><path d="M8 8h2M8 12h2M8 16h2M16.5 13h1M16.5 16h1" /></SiteIconSvg>
}

export function SiteBriefcase(props: SiteIconProps) {
  return <SiteIconSvg {...props}><rect x="3.5" y="7" width="17" height="12.5" rx="2" /><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7" /><path d="M3.5 12h17" /><path d="M10 12v2h4v-2" /></SiteIconSvg>
}

export function SiteLayers(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="m12 3.5 8 4.25-8 4.25-8-4.25 8-4.25Z" /><path d="m4 12 8 4.25L20 12" /><path d="m4 16.25 8 4.25 8-4.25" /></SiteIconSvg>
}

export function SiteRuler(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="m4.5 17.5 13-13 2 2-13 13-2-2Z" /><path d="m8 14 2 2M11 11l2 2M14 8l2 2" /></SiteIconSvg>
}

export function SiteCamera(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M4 8.5h3l1.5-2h7l1.5 2h3v10H4v-10Z" /><circle cx="12" cy="13.5" r="3" /></SiteIconSvg>
}

export function SiteImage(props: SiteIconProps) {
  return <SiteIconSvg {...props}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="8.5" cy="9" r="1.2" /><path d="m4.5 17 4.5-4 3 2.5 2.5-2 5 4" /></SiteIconSvg>
}

export function SiteClipboard(props: SiteIconProps) {
  return <SiteIconSvg {...props}><rect x="5" y="4.5" width="14" height="16" rx="2" /><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 17h4" /></SiteIconSvg>
}

export function SitePackage(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" /><path d="m4 7 8 4 8-4M12 11v10" /><path d="m8 5 8 4" /></SiteIconSvg>
}

export function SitePhone(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M7 4.5 9.5 4l2 4-1.8 1.8a14 14 0 0 0 4.5 4.5L16 12.5l4 2-.5 2.5c-.3 1.5-1.7 2.5-3.2 2.2A15.5 15.5 0 0 1 4.8 8.2C4.5 6.7 5.5 5.3 7 4.5Z" /></SiteIconSvg>
}

export function SiteMail(props: SiteIconProps) {
  return <SiteIconSvg {...props}><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4.5 7 7.5 5 7.5-5" /></SiteIconSvg>
}

export function SiteMapPin(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M19 10.5c0 5-7 10-7 10s-7-5-7-10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10.5" r="2.2" /></SiteIconSvg>
}

export function SiteCalendar(props: SiteIconProps) {
  return <SiteIconSvg {...props}><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M8 3.5v4M16 3.5v4M4 9.5h16M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" /></SiteIconSvg>
}

export function SiteList(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M9 6h10M9 12h10M9 18h10" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></SiteIconSvg>
}

export function SiteTag(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M4 5.5v6.2l8.3 8.3 6.2-6.2-8.3-8.3H4Z" /><circle cx="7.5" cy="8.5" r="1" /></SiteIconSvg>
}

export function SiteEuro(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M17.5 6.5A6 6 0 1 0 17.5 17.5" /><path d="M4.5 10h8M4.5 14h7" /></SiteIconSvg>
}

export function SiteMessage(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><path d="M7.5 10h.01M12 10h.01M16.5 10h.01" /></SiteIconSvg>
}

export function SiteSend(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="m4 4 16 8-16 8 3-8-3-8Z" /><path d="M7 12h13" /></SiteIconSvg>
}

export function SiteQuote(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M9.5 9H6.8A2.8 2.8 0 0 0 4 11.8v.4A2.8 2.8 0 0 0 6.8 15H8a2 2 0 0 0 2-2V9Zm10.5 0h-2.7a2.8 2.8 0 0 0-2.8 2.8v.4a2.8 2.8 0 0 0 2.8 2.8h1.2a2 2 0 0 0 2-2V9Z" /></SiteIconSvg>
}

export function SiteStar(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="m12 3.5 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.5Z" /></SiteIconSvg>
}

export function SiteUser(props: SiteIconProps) {
  return <SiteIconSvg {...props}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-3.3 3-5 7-5s6.3 1.7 7 5" /></SiteIconSvg>
}

export function SiteHeart(props: SiteIconProps) {
  return <SiteIconSvg {...props}><path d="M20 8.7c0 4.4-8 10.3-8 10.3S4 13.1 4 8.7A4.2 4.2 0 0 1 12 6a4.2 4.2 0 0 1 8 2.7Z" /></SiteIconSvg>
}

export function SiteGlobe(props: SiteIconProps) {
  return <SiteIconSvg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M3.8 12h16.4M12 3.5c2.1 2.3 3.1 5.1 3.1 8.5s-1 6.2-3.1 8.5c-2.1-2.3-3.1-5.1-3.1-8.5s1-6.2 3.1-8.5Z" /></SiteIconSvg>
}
