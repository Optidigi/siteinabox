import type { CollectionConfig } from "payload"
import { isSuperAdmin } from "@/access/isSuperAdmin"

import { accountLinkNamespaces, accountLinkPurposes, accountLinkLanes, accountLinkStates } from "@/lib/auth/accountLinkTypes"

// Only the reviewed backend protocol can change dispatch authority. Read-only
// operator metadata is separate from recipient, signed claims and token material.
export const AccountLinkDispatches: CollectionConfig = {
  slug: "account-link-dispatches",
  admin: { hidden: true },
  access: { create: () => false, read: isSuperAdmin, update: () => false, delete: () => false },
  fields: [
    { name: "scopeKey", type: "text", required: true, index: true },
    { name: "activeKey", type: "text", unique: true, index: true },
    { name: "namespace", type: "select", required: true, options: [...accountLinkNamespaces], index: true },
    { name: "purpose", type: "select", required: true, options: [...accountLinkPurposes] },
    { name: "lane", type: "select", required: true, options: [...accountLinkLanes] },
    { name: "recipient", type: "email", required: true, access: { read: () => false } },
    { name: "payloadUserId", type: "text" },
    { name: "previewUserId", type: "text" },
    { name: "tenantId", type: "text" },
    { name: "role", type: "text" },
    { name: "actorUserId", type: "text" },
    { name: "metadata", type: "json", access: { read: () => false } },
    { name: "origin", type: "text", required: true },
    { name: "callbackPath", type: "text", required: true },
    { name: "errorCallbackPath", type: "text", required: true },
    { name: "state", type: "select", required: true, defaultValue: "admitted", options: [...accountLinkStates], index: true },
    { name: "fence", type: "number", required: true, defaultValue: 1, min: 1 },
    { name: "leaseTokenHash", type: "text", access: { read: () => false } },
    { name: "leaseUntil", type: "date", index: true },
    { name: "tokenFingerprint", type: "text", unique: true, index: true, access: { read: () => false } },
    { name: "verificationId", type: "text", access: { read: () => false } },
    { name: "expiresAt", type: "date", index: true },
    { name: "sendAttempts", type: "number", required: true, defaultValue: 0, min: 0 },
    { name: "retryAt", type: "date", index: true },
    { name: "retryState", type: "select", required: true, defaultValue: "none", options: ["none", "retryable", "permanent", "manual_review"] },
    { name: "providerMessageId", type: "text" },
    { name: "outcomeCode", type: "text" },
    { name: "retentionAfter", type: "date", required: true, index: true },
  ],
}

export const AccountLinkWindows: CollectionConfig = {
  slug: "account-link-windows",
  admin: { hidden: true },
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    { name: "key", type: "text", unique: true, required: true },
    { name: "count", type: "number", required: true, defaultValue: 0, min: 0 },
    { name: "expiresAt", type: "date", required: true, index: true },
  ],
}

export const AccountLinkPolicies: CollectionConfig = {
  slug: "account-link-policies",
  admin: { hidden: true },
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    { name: "key", type: "text", unique: true, required: true },
    { name: "activatedAt", type: "date", required: true },
  ],
}
