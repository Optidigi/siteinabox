import * as React from "react"

type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string }
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, ...props }, ref) {
  const resolved = typeof href === "string" ? href : href.pathname ?? "/"
  return <a ref={ref} href={resolved} {...props} />
})

export default Link
