import type { ReactNode, SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string }

function BrandIcon({ children, className, name, size = 24, ...props }: IconProps & { children: ReactNode; name: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`lucide lucide-${name}${className ? ` ${className}` : ""}`}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  )
}

export function Twitter(props: IconProps) {
  return <BrandIcon name="twitter" {...props}><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" /></BrandIcon>
}

export function Dribbble(props: IconProps) {
  return <BrandIcon name="dribbble" {...props}><circle cx="12" cy="12" r="10" /><path d="M19.13 5.09C15.22 9.14 10 10.44 2.25 10.94" /><path d="M21.75 12.84c-6.62-1.41-12.14 1-16.38 6.32" /><path d="M8.56 2.75c4.37 6 6 9.42 8 17.72" /></BrandIcon>
}

export function TwitchIcon(props: IconProps) {
  return <BrandIcon name="twitch" {...props}><path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7" /></BrandIcon>
}

export function Github(props: IconProps) {
  return <BrandIcon name="github" {...props}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></BrandIcon>
}

export const TwitterIcon = Twitter
export const DribbbleIcon = Dribbble
export const GithubIcon = Github
