import { z } from "zod"
import { AppointmentSectionSchema } from "../appointments"
import { AboutBlockSchema } from "./about"
import { ContactBlockSchema } from "./contact"
import { CtaBlockSchema } from "./cta"
import { FaqBlockSchema } from "./faq"
import {
  HERO_BLOCK_TYPES,
  HeroBlockSchema,
} from "./hero"
import { ProcessBlockSchema } from "./process"
import { PricingBlockSchema } from "./pricing"
import { ReviewsBlockSchema } from "./reviews"
import { ServicesBlockSchema } from "./services"
import { WorkBlockSchema } from "./work"

export * from "./about"
export * from "./common"
export * from "./contact"
export * from "./cta"
export * from "./faq"
export * from "./hero"
export * from "./process"
export * from "./pricing"
export * from "./reviews"
export * from "./services"
export * from "./work"

export const SITEGEN_BLOCK_TYPES = [
  ...HERO_BLOCK_TYPES,
  "services",
  "about",
  "process",
  "work",
  "reviews",
  "pricing",
  "faq",
  "cta",
  "contact",
  "appointments",
] as const

export const BLOCK_TYPES = [...SITEGEN_BLOCK_TYPES] as const
export type SitegenBlockType = (typeof SITEGEN_BLOCK_TYPES)[number]
export type BlockType = (typeof BLOCK_TYPES)[number]

export const BlockSchema = z.discriminatedUnion("blockType", [
  HeroBlockSchema,
  ServicesBlockSchema,
  AboutBlockSchema,
  ProcessBlockSchema,
  WorkBlockSchema,
  ReviewsBlockSchema,
  PricingBlockSchema,
  FaqBlockSchema,
  CtaBlockSchema,
  ContactBlockSchema,
  AppointmentSectionSchema,
])

export type Block = z.infer<typeof BlockSchema>
