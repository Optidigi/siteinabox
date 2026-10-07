/// <reference types="astro/client" />

declare module "lottie-web/build/player/lottie_light.min.js" {
  import type { LottiePlayer } from "lottie-web"

  const lottie: LottiePlayer
  export default lottie
}

interface ImportMetaEnv {
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string
}
