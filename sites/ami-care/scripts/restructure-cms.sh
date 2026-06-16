#!/usr/bin/env bash
#
# scripts/restructure-cms.sh
#
# One-time post-/add-cms step: replace the seeded richText blocks on this
# site's home page with structured Hero/FeatureList/RichText/CTA blocks
# that drive amicare's Zen-skinned cms/*.tsx renderers.
#
# Usage:
#   PAYLOAD_API_URL=https://admin.siteinabox.nl \
#   PAYLOAD_API_TOKEN=<token> \
#   bash scripts/restructure-cms.sh <TENANT_ID>
#
# Idempotent: re-running overwrites the page's blocks with the same payload.
# Safe to run before or after /add-cms Phase 5.

set -euo pipefail

TID="${1:?tenant id required as first argument}"
: "${PAYLOAD_API_URL:?must be set in env}"
: "${PAYLOAD_API_TOKEN:?must be set in env}"

echo "[restructure-cms] tenant=${TID} api=${PAYLOAD_API_URL}"

# Find the home page for this tenant.
# `--globoff` disables curl's URL globbing so the bracketed query params
# (Payload's `where[tenant][equals]=...` filter syntax) aren't interpreted
# as range expansions.
PAGE_RESP=$(curl -fsS --globoff \
  "${PAYLOAD_API_URL}/api/pages?where[tenant][equals]=${TID}&where[slug][equals]=index&depth=0&limit=1" \
  -H "Authorization: users API-Key ${PAYLOAD_API_TOKEN}")

PAGE_ID=$(printf '%s' "$PAGE_RESP" | jq -r '.docs[0].id // empty')

if [[ -z "$PAGE_ID" ]]; then
  echo "FATAL: no page with slug='index' found for tenant=${TID}. Has /add-cms Phase 4 run?"
  exit 1
fi

echo "[restructure-cms] target page id=${PAGE_ID}"

# Build the structured blocks array.
#
# Block ordering and content match amicare's section structure:
#   0. Hero       → top section (eyebrow + headline + subheadline + Contact CTA)
#   1. FeatureList → Werkwijze section (3 principles with icons)
#   2. RichText   → Over mij section (2 paragraphs)
#   3. CTA        → Wat telt section (quote-style; primary.href=null so renderer uses quote layout)
#   4. CTA        → Contact section (primary.href=mailto:... so renderer uses contact layout)
#
# Rich text fields are RtRoot JSON, matching the current Payload schema.
# The `anchor` values mirror siteManifest.json defaults so navigation does not
# rely on renderer-side fallback ids.

BLOCKS=$(jq -n '
  def inline_text($text):
    { t: "root", variant: "inline", children: [{ t: "text", v: $text }] };

  def inline_em($pre; $em; $post):
    {
      t: "root",
      variant: "inline",
      children: [
        { t: "text", v: $pre },
        { t: "text", v: $em, marks: ["italic"] },
        { t: "text", v: $post }
      ]
    };

  def block_text($text):
    {
      t: "root",
      variant: "block",
      children: [
        { t: "paragraph", children: [{ t: "text", v: $text }] }
      ]
    };

  [
  {
    blockType: "hero",
    anchor: "top",
    eyebrow: inline_text("Voor jongeren en gezinnen"),
    headline: inline_em("Jeugdzorg met "; "hart"; " en toewijding."),
    subheadline: block_text("Al jarenlang werk ik met toewijding in de jeugdzorg. Dit is het vak dat ik ken — waar mijn hart ligt, en waar ik mij dagelijks voor inzet."),
    cta: { label: "Contact", href: "#contact" }
  },
  {
    blockType: "featureList",
    anchor: "werkwijze",
    intro: inline_text("Drie dingen"),
    title: inline_em("Wat voor mij "; "centraal staat"; "."),
    features: [
      { title: inline_text("Aandacht"),      description: block_text("Echt luisteren naar wat een jongere of een gezin op dat moment nodig heeft. Zonder aannames vooraf."), icon: "ear" },
      { title: inline_text("Betrokkenheid"), description: block_text("Naast mensen staan, niet erboven. Werken vanuit gelijkwaardigheid en vertrouwen."), icon: "heart-handshake" },
      { title: inline_text("Continuïteit"),  description: block_text("Aanwezig blijven, ook als trajecten lang of ingewikkeld worden. De relatie als basis."), icon: "clock" }
    ]
  },
  {
    blockType: "richText",
    anchor: "over",
    body: {
      t: "root",
      variant: "block",
      children: [
        { t: "themed", id: "eyebrow", props: { text: "Over mij" } },
        { t: "heading", level: 2, children: [
          { t: "text", v: "Het vak waar mijn " },
          { t: "text", v: "hart ligt", marks: ["italic"] },
          { t: "text", v: "." }
        ] },
        { t: "paragraph", children: [{ t: "text", v: "Tegelijk blijf ik mijzelf graag ontwikkelen, en sta ik open voor nieuwe uitdagingen en opdrachten binnen het werkveld." }] },
        { t: "paragraph", children: [{ t: "text", v: "Naast mijn werk ben ik moeder, en geniet ik van het drukke, gezellige gezinsleven. De combinatie van werk en gezin maakt mijn dagen dynamisch — en waardevol." }] }
      ]
    }
  },
  {
    blockType: "cta",
    anchor: "wat-telt",
    headline: inline_text("Vertrouwen ontstaat in de tijd, niet in één gesprek."),
    description: block_text("Daarom werk ik graag in trajecten waar continuïteit en kleine stappen het echte werk doen — voor jongeren, voor gezinnen, en voor de mensen om hen heen."),
    primary: {
      label: "(unused — required by schema, suppressed by quote-style renderer)",
      href: "#"
    }
  },
  {
    blockType: "cta",
    anchor: "contact",
    headline: inline_text("Wilt u meer informatie of in contact komen?"),
    primary: { label: "info@ami-care.nl", href: "mailto:info@ami-care.nl" }
  }
]')

BODY=$(jq -n --argjson blocks "$BLOCKS" '{blocks: $blocks}')

PATCH_RESP=$(curl -fsS -X PATCH \
  "${PAYLOAD_API_URL}/api/pages/${PAGE_ID}" \
  -H "Authorization: users API-Key ${PAYLOAD_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${BODY}")

NEW_BLOCK_COUNT=$(printf '%s' "$PATCH_RESP" | jq -r '.doc.blocks | length // 0')
echo "[restructure-cms] OK page ${PAGE_ID} now has ${NEW_BLOCK_COUNT} blocks"

if [[ "$NEW_BLOCK_COUNT" -ne 5 ]]; then
  echo "WARN: expected 5 blocks, got ${NEW_BLOCK_COUNT}. Inspect:"
  printf '%s' "$PATCH_RESP" | jq '.doc.blocks | map({blockType, blockName})'
  exit 2
fi

echo "[restructure-cms] done. Next request to https://ami-care.nl/ renders structured Zen layout."
echo "[restructure-cms] Note: Hero block has no image set. Upload toys.jpg to /api/media (tenant=${TID}) in Payload admin and link it to the Hero block to fully match current design."
