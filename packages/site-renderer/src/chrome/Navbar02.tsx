import {
  NavbarBrand,
  NavbarDesktop,
  NavbarMobile,
  type NavbarVariantProps,
} from "./NavbarShared"

export function Navbar02({ navbar, settings, links, mediaResolver }: NavbarVariantProps) {
  return (
    <div className="site-navbar-inner site-navbar-inner-02">
      <div className="site-navbar-layout">
        <NavbarBrand settings={settings} navbar={navbar} mediaResolver={mediaResolver} />
        <NavbarDesktop links={links} navbar={navbar} />
        <NavbarMobile links={links} navbar={navbar} />
      </div>
    </div>
  )
}
