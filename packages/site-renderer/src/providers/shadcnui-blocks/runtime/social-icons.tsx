import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string }

function BrandIcon({ children, size = 24, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  )
}

export function Dribbble(props: IconProps) {
  return <BrandIcon {...props}><circle cx="12" cy="12" r="9" /><path d="M7.5 4.8c4.8 5.8 6.7 9.8 8 14.4M4 10.5c5.7.2 10.2-1.1 13.2-4M6.1 18c3.2-4 7.4-5.8 13.5-4.7" /></BrandIcon>
}

export function Github(props: IconProps) {
  return <BrandIcon {...props}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7.4A5.8 5.8 0 0 0 19.3 3 5.4 5.4 0 0 0 19.1 1S17.9.6 15 2.5a13.4 13.4 0 0 0-6 0C6.1.6 4.9 1 4.9 1A5.4 5.4 0 0 0 4.7 3a5.8 5.8 0 0 0-1.5 4.1c0 5.8 3.5 7 6.8 7.4A4.8 4.8 0 0 0 9 18v4M9 19c-3 .9-3-1.5-4-2" /></BrandIcon>
}

export function Twitch(props: IconProps) {
  return <BrandIcon {...props}><path d="M4 3h17v11l-5 5h-4l-3 3v-3H4zM10 7v6M15 7v6" /></BrandIcon>
}

export function Twitter(props: IconProps) {
  return <BrandIcon {...props}><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2" /></BrandIcon>
}

export const DribbbleIcon = Dribbble
export const GithubIcon = Github
export const TwitchIcon = Twitch
export const TwitterIcon = Twitter
