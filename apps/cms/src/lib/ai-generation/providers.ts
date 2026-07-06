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
import { hashStableValue } from "@/lib/intake/normalizeIntake"
import { loadMockSiteGenerationSpec, type MockGenerationFixture } from "@/lib/intake/mockGeneration"
import {
  SITE_GENERATION_PROMPT_VERSION,
  SITE_GENERATION_SYSTEM_PROMPT,
  SUPPORTED_SITE_GENERATION_BLOCKS,
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

const approvedDesignVariantsFor = (blockType: string) =>
  SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS
    .filter((variant) => variant.slug === blockType)
    .map((variant) => variant.variant)

const approvedChromeVariantsFor = (area: SiteChromeCatalogArea) => [
  ...SITE_SELF_SERVE_CHROME_VARIANTS
    .filter((variant) => variant.area === area)
    .map((variant) => variant.variant),
  null,
]

const designVariantJsonSchemaFor = (blockType: string) => {
  const variants = approvedDesignVariantsFor(blockType)
  return variants.length > 0
    ? { type: "string", enum: variants }
    : stringOrNull
}

const baseBlockProperties = {
  designVariant: stringOrNull,
  anchor: stringOrNull,
} as const

const SELF_SERVE_GENERATION_BLOCK_TYPES = new Set<string>(SUPPORTED_SITE_GENERATION_BLOCKS)

const blockJsonSchemas = [
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "designVariant", "anchor", "eyebrow", "headline", "subheadline", "links", "cta", "secondary", "stats"],
    properties: {
      blockType: { type: "string", const: "hero" },
      ...baseBlockProperties,
      designVariant: designVariantJsonSchemaFor("hero"),
      eyebrow: { anyOf: [richTextInlineJsonSchema, { type: "null" }] },
      headline: richTextInlineJsonSchema,
      subheadline: { anyOf: [richTextBlockJsonSchema, { type: "null" }] },
      links: {
        type: "array",
        minItems: 0,
        maxItems: 4,
        items: linkJsonSchema,
      },
      cta: { anyOf: [linkJsonSchema, { type: "null" }] },
      secondary: { anyOf: [linkJsonSchema, { type: "null" }] },
      stats: {
        type: "array",
        minItems: 0,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["value", "label"],
          properties: { value: { type: "string" }, label: { type: "string" } },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "designVariant", "anchor", "eyebrow", "title", "intro", "features"],
    properties: {
      blockType: { type: "string", const: "featureList" },
      ...baseBlockProperties,
      designVariant: designVariantJsonSchemaFor("featureList"),
      eyebrow: { anyOf: [richTextInlineJsonSchema, { type: "null" }] },
      title: { anyOf: [richTextInlineJsonSchema, { type: "null" }] },
      intro: { anyOf: [richTextBlockJsonSchema, { type: "null" }] },
      image: mediaRefJsonSchema,
      features: {
        type: "array",
        minItems: 3,
        maxItems: 4,
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
    required: ["blockType", "designVariant", "anchor", "body"],
    properties: {
      blockType: { type: "string", const: "richText" },
      ...baseBlockProperties,
      designVariant: designVariantJsonSchemaFor("richText"),
      body: richTextBlockJsonSchema,
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "designVariant", "anchor", "headline", "description", "primary", "secondary", "backgroundImage"],
    properties: {
      blockType: { type: "string", const: "cta" },
      ...baseBlockProperties,
      designVariant: designVariantJsonSchemaFor("cta"),
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
    required: ["blockType", "designVariant", "anchor", "title", "description", "formName", "submitLabel", "fields"],
    properties: {
      blockType: { type: "string", const: "contactSection" },
      ...baseBlockProperties,
      designVariant: designVariantJsonSchemaFor("contactSection"),
      title: { anyOf: [richTextInlineJsonSchema, { type: "null" }] },
      description: { anyOf: [richTextBlockJsonSchema, { type: "null" }] },
      formName: { type: "string" },
      submitLabel: stringOrNull,
      fields: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "label", "type", "required"],
          properties: {
            name: { type: "string" },
            label: { type: "string" },
            type: { type: "string", enum: ["text", "email", "tel", "textarea", "select", "checkbox"] },
            required: { type: "boolean" },
            placeholder: stringOrNull,
            maxLength: { type: ["number", "null"] },
            options: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "value"],
                properties: { label: { type: "string" }, value: { type: "string" } },
              },
            },
          },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "designVariant", "anchor", "title", "items"],
    properties: {
      blockType: { type: "string", const: "faq" },
      ...baseBlockProperties,
      designVariant: designVariantJsonSchemaFor("faq"),
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
    required: ["blockType", "designVariant", "anchor", "items"],
    properties: {
      blockType: { type: "string", const: "testimonials" },
      ...baseBlockProperties,
      designVariant: designVariantJsonSchemaFor("testimonials"),
      logo: mediaRefJsonSchema,
      items: {
        type: "array",
        minItems: 1,
        maxItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["quote", "author", "role"],
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
    required: ["blockType", "designVariant", "anchor", "eyebrow", "title", "intro", "plans"],
    properties: {
      blockType: { type: "string", const: "pricing" },
      ...baseBlockProperties,
      designVariant: designVariantJsonSchemaFor("pricing"),
      eyebrow: nullableInlineRichTextJsonSchema,
      title: nullableInlineRichTextJsonSchema,
      intro: nullableBlockRichTextJsonSchema,
      plans: {
        type: "array",
        minItems: 2,
        maxItems: 2,
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
              minItems: 4,
              maxItems: 6,
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
    required: ["blockType", "designVariant", "anchor", "items"],
    properties: {
      blockType: { type: "string", const: "stats" },
      ...baseBlockProperties,
      designVariant: designVariantJsonSchemaFor("stats"),
      items: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["value", "label"],
          properties: { value: { type: "string" }, label: { type: "string" } },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "designVariant", "anchor", "title", "logos"],
    properties: {
      blockType: { type: "string", const: "logoCloud" },
      ...baseBlockProperties,
      designVariant: designVariantJsonSchemaFor("logoCloud"),
      title: nullableInlineRichTextJsonSchema,
      logos: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "href"],
          properties: { name: { type: "string" }, image: mediaRefJsonSchema, href: stringOrNull },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "designVariant", "anchor", "title", "intro", "images", "cta"],
    properties: {
      blockType: { type: "string", const: "gallery" },
      ...baseBlockProperties,
      designVariant: designVariantJsonSchemaFor("gallery"),
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
    required: ["blockType", "designVariant", "anchor", "title", "intro", "members"],
    properties: {
      blockType: { type: "string", const: "team" },
      ...baseBlockProperties,
      designVariant: designVariantJsonSchemaFor("team"),
      title: nullableInlineRichTextJsonSchema,
      intro: nullableBlockRichTextJsonSchema,
      members: {
        type: "array",
        minItems: 2,
        maxItems: 6,
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
    required: ["blockType", "designVariant", "anchor", "title", "description", "emailLabel", "emailPlaceholder", "submitLabel", "benefits"],
    properties: {
      blockType: { type: "string", const: "newsletter" },
      ...baseBlockProperties,
      designVariant: designVariantJsonSchemaFor("newsletter"),
      title: richTextInlineJsonSchema,
      description: richTextBlockJsonSchema,
      emailLabel: stringOrNull,
      emailPlaceholder: stringOrNull,
      submitLabel: { type: "string" },
      benefits: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description"],
          properties: {
            title: richTextInlineJsonSchema,
            description: richTextBlockJsonSchema,
          },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "designVariant", "anchor", "title", "intro", "items"],
    properties: {
      blockType: { type: "string", const: "bentoGrid" },
      ...baseBlockProperties,
      designVariant: designVariantJsonSchemaFor("bentoGrid"),
      title: richTextInlineJsonSchema,
      intro: richTextBlockJsonSchema,
      items: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description", "image"],
          properties: {
            title: richTextInlineJsonSchema,
            description: richTextBlockJsonSchema,
            image: mediaRefJsonSchema,
          },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "designVariant", "anchor", "eyebrow", "title", "intro", "body", "image", "features", "bridge", "secondaryTitle", "secondaryBody"],
    properties: {
      blockType: { type: "string", const: "contentSection" },
      ...baseBlockProperties,
      designVariant: designVariantJsonSchemaFor("contentSection"),
      eyebrow: nullableInlineRichTextJsonSchema,
      title: richTextInlineJsonSchema,
      intro: richTextBlockJsonSchema,
      body: richTextBlockJsonSchema,
      image: mediaRefJsonSchema,
      features: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description"],
          properties: {
            title: richTextInlineJsonSchema,
            description: richTextBlockJsonSchema,
          },
        },
      },
      bridge: richTextBlockJsonSchema,
      secondaryTitle: richTextInlineJsonSchema,
      secondaryBody: richTextBlockJsonSchema,
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["blockType", "designVariant", "anchor", "title", "intro", "posts"],
    properties: {
      blockType: { type: "string", const: "blogCards" },
      ...baseBlockProperties,
      designVariant: designVariantJsonSchemaFor("blogCards"),
      title: nullableInlineRichTextJsonSchema,
      intro: nullableBlockRichTextJsonSchema,
      posts: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "excerpt", "image", "href", "date", "author", "authorRole", "cta"],
          properties: {
            title: richTextInlineJsonSchema,
            excerpt: nullableBlockRichTextJsonSchema,
            image: mediaRefJsonSchema,
            href: stringOrNull,
            date: stringOrNull,
            author: stringOrNull,
            authorRole: stringOrNull,
            cta: nullableLinkJsonSchema,
          },
        },
      },
    },
  },
] as const

const selfServeBlockJsonSchemas = blockJsonSchemas.filter((schema) =>
  SELF_SERVE_GENERATION_BLOCK_TYPES.has(schema.properties.blockType.const),
)

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
      required: ["version", "appearance", "colors", "fonts", "density", "shape"],
      properties: {
        version: { type: "number", const: 2 },
        appearance: {
          type: "object",
          additionalProperties: false,
          required: ["mode", "defaultMode"],
          properties: {
            mode: { type: "string", enum: ["light", "dark", "system"] },
            defaultMode: { type: "string", enum: ["light", "dark"] },
          },
        },
        colors: {
          type: "object",
          additionalProperties: false,
          required: ["schemeId"],
          properties: {
            schemeId: { type: "string", enum: ["tailwind-default", "tailwind-emerald", "tailwind-slate"] },
            lightSchemeId: { type: "string", enum: ["tailwind-default", "tailwind-emerald", "tailwind-slate"] },
            darkSchemeId: { type: "string", enum: ["tailwind-default", "tailwind-emerald", "tailwind-slate"] },
          },
        },
        fonts: {
          type: "object",
          additionalProperties: false,
          required: ["schemeId"],
          properties: {
            schemeId: { type: "string", enum: ["tailwind-default", "system", "editorial-serif"] },
          },
        },
        density: {
          type: "object",
          additionalProperties: false,
          required: ["schemeId"],
          properties: { schemeId: { type: "string", enum: ["tailwind-default", "compact", "comfortable"] } },
        },
        shape: {
          type: "object",
          additionalProperties: false,
          required: ["schemeId"],
          properties: { schemeId: { type: "string", enum: ["tailwind-default", "sharp", "soft", "rounded"] } },
        },
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
            items: { anyOf: selfServeBlockJsonSchemas },
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
        properties: { slug: { type: "string", enum: SUPPORTED_SITE_GENERATION_BLOCKS }, label: { type: "string" } },
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
