type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "ghost" | "link"

const ROLE: Record<string, BadgeVariant> = {
  "super-admin": "default",
  owner: "default",
  editor: "default",
  viewer: "default",
}

const STATUS: Record<string, BadgeVariant> = {
  published: "success",
  active: "success",
  draft: "secondary",
  suspended: "warning",
  spam: "destructive",
  new: "secondary",
  contacted: "secondary",
  provisioning: "secondary",
  submitted: "secondary",
  normalized: "secondary",
  queued: "secondary",
  generating: "warning",
  generated: "secondary",
  validating: "warning",
  applying: "warning",
  draft_ready: "warning",
  preview_ready: "success",
  failed: "destructive",
  archived: "outline",
}

export function roleVariant(role: string): BadgeVariant {
  return ROLE[role] ?? "outline"
}

export function statusVariant(status?: string): BadgeVariant {
  return STATUS[status ?? ""] ?? "outline"
}
