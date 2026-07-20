import type { CSSProperties } from "react"

export const providerCircuitBoardStyle: CSSProperties = {
  backgroundImage: `
        repeating-linear-gradient(0deg, transparent, transparent 19px, var(--provider-grid-line, rgba(75, 85, 99, 0.08)) 19px, var(--provider-grid-line, rgba(75, 85, 99, 0.08)) 20px, transparent 20px, transparent 39px, var(--provider-grid-line, rgba(75, 85, 99, 0.08)) 39px, var(--provider-grid-line, rgba(75, 85, 99, 0.08)) 40px),
        repeating-linear-gradient(90deg, transparent, transparent 19px, var(--provider-grid-line, rgba(75, 85, 99, 0.08)) 19px, var(--provider-grid-line, rgba(75, 85, 99, 0.08)) 20px, transparent 20px, transparent 39px, var(--provider-grid-line, rgba(75, 85, 99, 0.08)) 39px, var(--provider-grid-line, rgba(75, 85, 99, 0.08)) 40px),
        radial-gradient(circle at 20px 20px, var(--provider-grid-dot, rgba(55, 65, 81, 0.12)) 2px, transparent 2px),
        radial-gradient(circle at 40px 40px, var(--provider-grid-dot, rgba(55, 65, 81, 0.12)) 2px, transparent 2px)
      `,
  backgroundSize: "40px 40px, 40px 40px, 40px 40px, 40px 40px",
}
