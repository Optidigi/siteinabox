import {
  GenerationInputSchema,
  NormalizedIntakeSchema,
  SiteGenerationSpecSchema,
  type GenerationInput,
  type NormalizedIntake,
  type SiteGenerationSpec,
} from "@siteinabox/contracts/generation"
import {
  SITE_SELF_SERVE_CHROME_VARIANTS,
  SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS,
  type SiteChromeCatalogArea,
} from "@siteinabox/contracts/block-catalog"
import { SITE_BLOCK_SLUGS } from "@siteinabox/contracts/site"
import { hashStableValue } from "@/lib/intake/normalizeIntake"
import { loadMockSiteGenerationSpec, type MockGenerationFixture } from "@/lib/intake/mockGeneration"
import {
  SITE_GENERATION_PROMPT_VERSION,
  SITE_GENERATION_SYSTEM_PROMPT,
} from "./prompts/siteGenerationPrompt"
import { buildSiteGenerationModelInput, type SiteGenerationModelInput } from "./siteGenerationInput"

export type SiteGenerationProviderName = "mock" | "openai"

export type SiteGenerationProviderRequest = {
  normalized: NormalizedIntake
  input: SiteGenerationModelInput
  inputHash: string
}

export type SiteGenerationProviderResult = {
  provider: SiteGenerationProviderName | string
  model: string
  promptVersion: string
  input: SiteGenerationModelInput
  inputHash: string
  outputHash?: string
  rawOutput?: string
  parsedOutput?: unknown
  spec?: SiteGenerationSpec
}

export interface SiteGenerationProvider {
  name: SiteGenerationProviderName | string
  model: string
  promptVersion: string
  generate(request: SiteGenerationProviderRequest): Promise<SiteGenerationProviderResult>
}

export type SiteGenerationProviderConfig = {
  provider?: SiteGenerationProviderName
  model?: string
  mockFixture?: MockGenerationFixture
  apiKey?: string
  baseUrl?: string
}

const outputHash = (value: unknown): string => hashStableValue(value)
const stringOrNull = { type: ["string", "null"] }
const richTextInlineJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["t", "variant", "children"],
  properties: {
    t: { type: "string", const: "root" },
    variant: { type: "string", const: "inline" },
    children: {
      type: "array",
      items: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["t", "v"],
            properties: { t: { type: "string", const: "text" }, v: { type: "string" } },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["t"],
            properties: { t: { type: "string", const: "linebreak" } },
          },
        ],
      },
    },
  },
} as const

const richTextBlockJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["t", "variant", "children"],
  properties: {
    t: { type: "string", const: "root" },
    variant: { type: "string", const: "block" },
    children: {
      type: "array",
      items: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["t", "children"],
            properties: {
              t: { type: "string", const: "paragraph" },
              children: richTextInlineJsonSchema.properties.children,
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["t", "level", "children"],
            properties: {
              t: { type: "string", const: "heading" },
              level: { type: "number", enum: [2, 3, 4] },
              children: richTextInlineJsonSchema.properties.children,
            },
          },
        ],
      },
    },
  },
} as const

const mediaRefJsonSchema = {
  anyOf: [
    { type: "string" },
    { type: "number" },
    { type: "null" },
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "url", "filename", "alt"],
      properties: {
        id: { anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }] },
        url: stringOrNull,
        filename: stringOrNull,
        alt: stringOrNull,
      },
    },
  ],
} as const

const linkJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "href"],
  properties: { label: stringOrNull, href: stringOrNull },
} as const

const nullableLinkJsonSchema = { anyOf: [linkJsonSchema, { type: "null" }] } as const
const nullableInlineRichTextJsonSchema = { anyOf: [richTextInlineJsonSchema, { type: "null" }] } as const
const nullableBlockRichTextJsonSchema = { anyOf: [richTextBlockJsonSchema, { type: "null" }] } as const

const approvedSectionVariantsFor = (blockType: string) =>
  SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS
    .filter((variant) => variant.slug === blockType)
    .map((variant) => variant.sectionVariant)

const approvedChromeVariantsFor = (area: SiteChromeCatalogArea) => [
  ...SITE_SELF_SERVE_CHROME_VARIANTS
    .filter((variant) => variant.area === area)
    .map((variant) => variant.variant),
  null,
]

const analyticsJsonSchemaFor = (blockType: string) => {
  const variants = approvedSectionVariantsFor(blockType)
  return {
    type: "object",
    additionalProperties: false,
    required: ["sectionVariant"],
    properties: {
      sectionVariant: variants.length > 0
        ? { type: ["string", "null"], enum: [...variants, null] }
        : stringOrNull,
    },
  } as const
}

const baseBlockProperties = {
  anchor: stringOrNull,
} as const

const blockJsonSchemas = [
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "anchor", "analytics", "eyebrow", "headline", "subheadline", "pills", "cta", "image"],
    properties: {
      blockType: { type: "string", const: "hero" },
      ...baseBlockProperties,
      analytics: analyticsJsonSchemaFor("hero"),
      eyebrow: { anyOf: [richTextInlineJsonSchema, { type: "null" }] },
      headline: richTextInlineJsonSchema,
      subheadline: { anyOf: [richTextBlockJsonSchema, { type: "null" }] },
      pills: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label"],
          properties: { label: { type: "string" } },
        },
      },
      cta: { anyOf: [linkJsonSchema, { type: "null" }] },
      image: mediaRefJsonSchema,
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "anchor", "analytics", "title", "intro", "features"],
    properties: {
      blockType: { type: "string", const: "featureList" },
      ...baseBlockProperties,
      analytics: analyticsJsonSchemaFor("featureList"),
      title: { anyOf: [richTextInlineJsonSchema, { type: "null" }] },
      intro: { anyOf: [richTextBlockJsonSchema, { type: "null" }] },
      features: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description", "icon"],
          properties: {
            title: richTextInlineJsonSchema,
            description: { anyOf: [richTextBlockJsonSchema, { type: "null" }] },
            icon: stringOrNull,
          },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "anchor", "analytics", "body"],
    properties: {
      blockType: { type: "string", const: "richText" },
      ...baseBlockProperties,
      analytics: analyticsJsonSchemaFor("richText"),
      body: richTextBlockJsonSchema,
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "anchor", "analytics", "eyebrow", "headline", "description", "primary", "secondary", "backgroundImage"],
    properties: {
      blockType: { type: "string", const: "cta" },
      ...baseBlockProperties,
      analytics: analyticsJsonSchemaFor("cta"),
      eyebrow: { anyOf: [richTextInlineJsonSchema, { type: "null" }] },
      headline: richTextInlineJsonSchema,
      description: { anyOf: [richTextBlockJsonSchema, { type: "null" }] },
      primary: { anyOf: [linkJsonSchema, { type: "null" }] },
      secondary: { anyOf: [linkJsonSchema, { type: "null" }] },
      backgroundImage: mediaRefJsonSchema,
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "anchor", "analytics", "title", "description", "formName", "submitLabel", "fields"],
    properties: {
      blockType: { type: "string", const: "contactSection" },
      ...baseBlockProperties,
      analytics: analyticsJsonSchemaFor("contactSection"),
      title: { anyOf: [richTextInlineJsonSchema, { type: "null" }] },
      description: { anyOf: [richTextBlockJsonSchema, { type: "null" }] },
      formName: { type: "string" },
      submitLabel: stringOrNull,
      fields: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "label", "type", "required"],
          properties: {
            name: { type: "string" },
            label: { type: "string" },
            type: { type: "string", enum: ["text", "email", "tel", "textarea"] },
            required: { type: "boolean" },
          },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "anchor", "analytics", "title", "items"],
    properties: {
      blockType: { type: "string", const: "faq" },
      ...baseBlockProperties,
      analytics: analyticsJsonSchemaFor("faq"),
      title: { anyOf: [richTextInlineJsonSchema, { type: "null" }] },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "answer"],
          properties: { question: richTextInlineJsonSchema, answer: richTextBlockJsonSchema },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "anchor", "analytics", "title", "items"],
    properties: {
      blockType: { type: "string", const: "testimonials" },
      ...baseBlockProperties,
      analytics: analyticsJsonSchemaFor("testimonials"),
      title: stringOrNull,
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["quote", "author", "role", "avatar"],
          properties: {
            quote: { type: "string" },
            author: { type: "string" },
            role: stringOrNull,
            avatar: mediaRefJsonSchema,
          },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "anchor", "analytics", "title", "intro", "plans"],
    properties: {
      blockType: { type: "string", const: "pricing" },
      ...baseBlockProperties,
      analytics: analyticsJsonSchemaFor("pricing"),
      title: nullableInlineRichTextJsonSchema,
      intro: nullableBlockRichTextJsonSchema,
      plans: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description", "price", "period", "features", "cta", "badge", "highlighted"],
          properties: {
            title: richTextInlineJsonSchema,
            description: nullableBlockRichTextJsonSchema,
            price: stringOrNull,
            period: stringOrNull,
            features: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "included"],
                properties: { label: richTextInlineJsonSchema, included: { type: ["boolean", "null"] } },
              },
            },
            cta: nullableLinkJsonSchema,
            badge: stringOrNull,
            highlighted: { type: ["boolean", "null"] },
          },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "anchor", "analytics", "title", "intro", "items"],
    properties: {
      blockType: { type: "string", const: "stats" },
      ...baseBlockProperties,
      analytics: analyticsJsonSchemaFor("stats"),
      title: nullableInlineRichTextJsonSchema,
      intro: nullableBlockRichTextJsonSchema,
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["value", "label", "description"],
          properties: { value: { type: "string" }, label: { type: "string" }, description: nullableBlockRichTextJsonSchema },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "anchor", "analytics", "title", "intro", "logos"],
    properties: {
      blockType: { type: "string", const: "logoCloud" },
      ...baseBlockProperties,
      analytics: analyticsJsonSchemaFor("logoCloud"),
      title: nullableInlineRichTextJsonSchema,
      intro: nullableBlockRichTextJsonSchema,
      logos: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "image", "href"],
          properties: { name: { type: "string" }, image: mediaRefJsonSchema, href: stringOrNull },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "anchor", "analytics", "title", "intro", "images", "cta"],
    properties: {
      blockType: { type: "string", const: "gallery" },
      ...baseBlockProperties,
      analytics: analyticsJsonSchemaFor("gallery"),
      title: nullableInlineRichTextJsonSchema,
      intro: nullableBlockRichTextJsonSchema,
      images: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["image", "caption", "link"],
          properties: { image: mediaRefJsonSchema, caption: nullableBlockRichTextJsonSchema, link: nullableLinkJsonSchema },
        },
      },
      cta: nullableLinkJsonSchema,
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "anchor", "analytics", "title", "intro", "members"],
    properties: {
      blockType: { type: "string", const: "team" },
      ...baseBlockProperties,
      analytics: analyticsJsonSchemaFor("team"),
      title: nullableInlineRichTextJsonSchema,
      intro: nullableBlockRichTextJsonSchema,
      members: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "role", "bio", "image", "links"],
          properties: {
            name: { type: "string" },
            role: stringOrNull,
            bio: nullableBlockRichTextJsonSchema,
            image: mediaRefJsonSchema,
            links: { type: "array", items: linkJsonSchema },
          },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "anchor", "analytics", "title", "intro", "posts"],
    properties: {
      blockType: { type: "string", const: "blogCards" },
      ...baseBlockProperties,
      analytics: analyticsJsonSchemaFor("blogCards"),
      title: nullableInlineRichTextJsonSchema,
      intro: nullableBlockRichTextJsonSchema,
      posts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "excerpt", "image", "href", "date", "author", "cta"],
          properties: {
            title: richTextInlineJsonSchema,
            excerpt: nullableBlockRichTextJsonSchema,
            image: mediaRefJsonSchema,
            href: stringOrNull,
            date: stringOrNull,
            author: stringOrNull,
            cta: nullableLinkJsonSchema,
          },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "anchor", "analytics", "title", "intro", "steps"],
    properties: {
      blockType: { type: "string", const: "processSteps" },
      ...baseBlockProperties,
      analytics: analyticsJsonSchemaFor("processSteps"),
      title: nullableInlineRichTextJsonSchema,
      intro: nullableBlockRichTextJsonSchema,
      steps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description", "icon", "image", "cta"],
          properties: {
            title: richTextInlineJsonSchema,
            description: nullableBlockRichTextJsonSchema,
            icon: stringOrNull,
            image: mediaRefJsonSchema,
            cta: nullableLinkJsonSchema,
          },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "anchor", "analytics", "title", "intro", "columns", "rows"],
    properties: {
      blockType: { type: "string", const: "comparison" },
      ...baseBlockProperties,
      analytics: analyticsJsonSchemaFor("comparison"),
      title: nullableInlineRichTextJsonSchema,
      intro: nullableBlockRichTextJsonSchema,
      columns: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description", "cta"],
          properties: { title: richTextInlineJsonSchema, description: nullableBlockRichTextJsonSchema, cta: nullableLinkJsonSchema },
        },
      },
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "values"],
          properties: {
            label: { type: "string" },
            values: { type: "array", items: { type: ["string", "boolean", "null"] } },
          },
        },
      },
    },
  },
] as const

const extractOpenAIOutputText = (response: any): string => {
  if (typeof response?.output_text === "string") return response.output_text

  const text = response?.output
    ?.flatMap((item: any) => item?.content ?? [])
    ?.filter((content: any) => content?.type === "output_text" && typeof content.text === "string")
    ?.map((content: any) => content.text)
    ?.join("")

  if (typeof text === "string" && text.trim()) return text
  throw new Error("OpenAI response did not include output text")
}

export const createMockSiteGenerationProvider = (
  fixture: MockGenerationFixture = "generic",
): SiteGenerationProvider => ({
  name: "mock",
  model: `fixture:${fixture}`,
  promptVersion: SITE_GENERATION_PROMPT_VERSION,
  async generate(request) {
    const spec = loadMockSiteGenerationSpec(request.normalized, fixture)
    const parsedOutput = spec
    return {
      provider: "mock",
      model: `fixture:${fixture}`,
      promptVersion: SITE_GENERATION_PROMPT_VERSION,
      input: request.input,
      inputHash: request.inputHash,
      outputHash: outputHash(parsedOutput),
      rawOutput: JSON.stringify(parsedOutput),
      parsedOutput,
      spec,
    }
  },
})

export const siteGenerationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "intake", "tenant", "theme", "settings", "pages", "blocks", "assets", "generatedAt", "generator"],
  properties: {
    schemaVersion: { type: "number", const: 1 },
    intake: {
      type: "object",
      additionalProperties: false,
      required: ["businessName", "tenantSlug", "primaryDomain", "siteUrl", "language", "serviceArea", "goals", "requestedPages"],
      properties: {
        businessName: { type: "string" },
        tenantSlug: { type: "string" },
        primaryDomain: { type: "string" },
        siteUrl: { type: "string" },
        language: { type: "string" },
        serviceArea: { type: "array", items: { type: "string" } },
        goals: { type: "array", items: { type: "string" } },
        requestedPages: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["slug", "title", "purpose"],
            properties: { slug: { type: "string" }, title: { type: "string" }, purpose: stringOrNull },
          },
        },
      },
    },
    tenant: {
      type: "object",
      additionalProperties: false,
      required: ["name", "slug", "domain", "status"],
      properties: {
        name: { type: "string" },
        slug: { type: "string" },
        domain: { type: "string" },
        status: { type: "string", enum: ["provisioning", "active", "suspended", "archived"] },
      },
    },
    theme: {
      type: "object",
      additionalProperties: false,
      required: ["colors", "fonts", "radius", "density", "stylePreset", "borderStyle", "mode"],
      properties: {
        colors: {
          type: "object",
          additionalProperties: false,
          required: ["accent", "bg", "ink", "muted", "card", "secondary", "rule"],
          properties: {
            accent: { type: "string" },
            bg: { type: "string" },
            ink: { type: "string" },
            muted: { type: "string" },
            card: { type: "string" },
            secondary: { type: "string" },
            rule: { type: "string" },
          },
        },
        fonts: {
          type: "object",
          additionalProperties: false,
          required: ["title", "heading", "text", "script"],
          properties: {
            title: { type: "string" },
            heading: { type: "string" },
            text: { type: "string" },
            script: { type: "string" },
          },
        },
        radius: { type: "string" },
        density: { type: "string", enum: ["compact", "comfortable", "spacious"] },
        stylePreset: { type: "string" },
        borderStyle: { type: "string", enum: ["solid", "dashed", "none"] },
        mode: { type: "string", enum: ["light", "dark"] },
      },
    },
    settings: {
      type: "object",
      additionalProperties: false,
      required: ["siteName", "siteUrl", "description", "language", "contactEmail", "navHeader", "navFooter", "chrome"],
      properties: {
        siteName: { type: "string" },
        siteUrl: { type: "string" },
        description: stringOrNull,
        language: { type: "string" },
        contactEmail: stringOrNull,
        navHeader: { type: "array", items: linkJsonSchema },
        navFooter: { type: "array", items: linkJsonSchema },
        chrome: {
          type: "object",
          additionalProperties: false,
          required: ["header", "footer", "banner"],
          properties: {
            header: {
              type: "object",
              additionalProperties: false,
              required: ["variant", "behavior", "activeMode", "mobileMenu", "cta"],
              properties: {
                variant: { type: ["string", "null"], enum: approvedChromeVariantsFor("header") },
                behavior: { type: ["string", "null"], enum: ["static", "sticky", null] },
                activeMode: { type: ["string", "null"], enum: ["path", "anchor", "none", null] },
                mobileMenu: { type: ["string", "null"], enum: ["dropdown", "drawer", null] },
                cta: nullableLinkJsonSchema,
              },
            },
            footer: {
              type: "object",
              additionalProperties: false,
              required: ["variant", "tagline", "copyright", "legalLinks", "columns"],
              properties: {
                variant: { type: ["string", "null"], enum: approvedChromeVariantsFor("footer") },
                tagline: stringOrNull,
                copyright: stringOrNull,
                legalLinks: { type: "array", items: linkJsonSchema },
                columns: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "items"],
                    properties: {
                      id: stringOrNull,
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["id", "type", "label", "text", "links"],
                          properties: {
                            id: stringOrNull,
                            type: { type: ["string", "null"], enum: ["brand", "text", "links", "contact", "business", "navigation", null] },
                            label: stringOrNull,
                            text: stringOrNull,
                            links: { type: "array", items: linkJsonSchema },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            banner: {
              type: "object",
              additionalProperties: false,
              required: ["variant", "visible", "title", "message", "link", "dismissible"],
              properties: {
                variant: { type: ["string", "null"], enum: approvedChromeVariantsFor("banner") },
                visible: { type: ["boolean", "null"] },
                title: stringOrNull,
                message: { type: "string" },
                link: nullableLinkJsonSchema,
                dismissible: { type: ["boolean", "null"] },
              },
            },
          },
        },
      },
    },
    pages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slug", "title", "status", "seo", "blocks"],
        properties: {
          slug: { type: "string" },
          title: { type: "string" },
          status: { type: "string", enum: ["draft", "published"] },
          seo: {
            type: "object",
            additionalProperties: false,
            required: ["title", "description", "ogImage"],
            properties: { title: stringOrNull, description: stringOrNull, ogImage: mediaRefJsonSchema },
          },
          blocks: {
            type: "array",
            items: { anyOf: blockJsonSchemas },
          },
        },
      },
    },
    blocks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slug", "label"],
        properties: { slug: { type: "string", enum: [...SITE_BLOCK_SLUGS] }, label: { type: "string" } },
      },
    },
    assets: { type: "array", items: mediaRefJsonSchema },
    generatedAt: { type: "string" },
    generator: {
      type: "object",
      additionalProperties: false,
      required: ["name", "version", "model"],
      properties: { name: { type: "string" }, version: { type: "string" }, model: { type: "string" } },
    },
  },
}

export const createOpenAISiteGenerationProvider = (config: SiteGenerationProviderConfig = {}): SiteGenerationProvider => {
  const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY
  const model = config.model ?? process.env.SITE_GENERATION_OPENAI_MODEL ?? "gpt-5.5"
  const baseUrl = (config.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "")

  return {
    name: "openai",
    model,
    promptVersion: SITE_GENERATION_PROMPT_VERSION,
    async generate(request) {
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is required when SITE_GENERATION_PROVIDER=openai")
      }

      const response = await fetch(`${baseUrl}/responses`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          store: false,
          input: [
            { role: "developer", content: SITE_GENERATION_SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(request.input) },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "site_generation_spec",
              strict: true,
              schema: siteGenerationJsonSchema,
            },
          },
        }),
      })

      const body = await response.json().catch(() => null)
      if (!response.ok) {
        const message = typeof body?.error?.message === "string" ? body.error.message : `OpenAI request failed with ${response.status}`
        throw new Error(message)
      }

      const rawOutput = extractOpenAIOutputText(body)
      const parsedOutput = JSON.parse(rawOutput)
      const parsedSpec = SiteGenerationSpecSchema.safeParse(parsedOutput)
      return {
        provider: "openai",
        model,
        promptVersion: SITE_GENERATION_PROMPT_VERSION,
        input: request.input,
        inputHash: request.inputHash,
        outputHash: outputHash(parsedOutput),
        rawOutput,
        parsedOutput,
        ...(parsedSpec.success ? { spec: parsedSpec.data } : {}),
      }
    },
  }
}

export const resolveSiteGenerationProvider = (config: SiteGenerationProviderConfig = {}): SiteGenerationProvider => {
  const provider = config.provider ?? (process.env.SITE_GENERATION_PROVIDER as SiteGenerationProviderName | undefined) ?? "mock"
  if (provider === "openai") return createOpenAISiteGenerationProvider(config)
  return createMockSiteGenerationProvider(config.mockFixture)
}

export const createSiteGenerationProviderRequest = (
  normalized: NormalizedIntake,
  generationInput?: GenerationInput,
): SiteGenerationProviderRequest => {
  const parsedNormalized = NormalizedIntakeSchema.parse(normalized)
  const parsedGenerationInput = generationInput ? GenerationInputSchema.parse(generationInput) : undefined
  const input = buildSiteGenerationModelInput(parsedNormalized, parsedGenerationInput)
  return {
    normalized: parsedNormalized,
    input,
    inputHash: hashStableValue({
      promptVersion: SITE_GENERATION_PROMPT_VERSION,
      input,
    }),
  }
}
