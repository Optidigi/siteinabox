import "@/styles/generated-site-renderer.css"

export default function RendererFrameRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
