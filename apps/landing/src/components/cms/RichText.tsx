/**
 * RichText block renderer (Preact).
 *
 * v1: `body` is a plain textarea field in the CMS Block. This legacy snapshot
 * renderer uses dangerouslySetInnerHTML to support pre-serialized HTML from
 * Payload. This is operator-trusted content —
 * only authenticated CMS editors write block content; we do not accept
 * untrusted input here.
 *
 * v2 (per the CMS field admin comment) plans a Tiptap-backed editor;
 * renderer swaps with no API change.
 *
 * NOTE: spec drops the `heading` field that the prior .astro accepted —
 * the CMS Block doesn't define it.
 */
export type RichTextProps = {
  body: string  // required by CMS Block
  dataBlockIndex?: number  // set by PreviewIsland's PreactBlocks; absent in production
}

export default function RichText({ body, dataBlockIndex }: RichTextProps) {
  if (!body) return null
  return (
    <section class="cms-block cms-block--richtext py-12 md:py-16" data-block-index={dataBlockIndex}>
      <div
        class="container mx-auto px-4 prose prose-lg max-w-3xl"
        dangerouslySetInnerHTML={{ __html: body }}
      />
    </section>
  )
}
