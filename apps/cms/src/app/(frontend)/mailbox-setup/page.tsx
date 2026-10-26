import type { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { PageHeader } from "@/components/page-header"
import { MailboxSetupReveal } from "./MailboxSetupReveal"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Mailbox setup", robots: { index: false, follow: false, noarchive: true } }

export default function MailboxSetupPage() {
  return <main className="mx-auto grid min-h-[min(100vh,100dvh)] w-full max-w-2xl content-center gap-5 px-4 py-10">
    <PageHeader title="Mailbox setup" subtitle="Secure sign-in details from Siteinabox." />
    <Card>
      <CardHeader><CardTitle>Your Microsoft 365 mailbox</CardTitle></CardHeader>
      <CardContent><MailboxSetupReveal /></CardContent>
    </Card>
  </main>
}
