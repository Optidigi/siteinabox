"use client"
import * as React from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin"
import { createPortal } from "react-dom"
import { $createParagraphNode, $getSelection, $isRangeSelection } from "lexical"
import { $setBlocksType } from "@lexical/selection"
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text"
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list"
import { $createThemedNode } from "@/lib/richText/lexical/ThemedNode"
import type { RtManifest } from "@/lib/richText/manifest"
import { ThemedNodeDialog } from "@/components/editor/richText/toolbar/themed-node-dialog"
import { useTranslations } from "next-intl"

class SlashOption extends MenuOption {
  constructor(
    public title: string,
    public onSelect: () => void,
  ) {
    super(title)
  }
}

export const SlashMenu: React.FC<{ manifest: RtManifest }> = ({ manifest }) => {
  const t = useTranslations("editor")
  const [editor] = useLexicalComposerContext()
  const triggerMatch = useBasicTypeaheadTriggerMatch("/", { minLength: 0 })
  const [pending, setPending] = React.useState<{
    def: NonNullable<RtManifest["themedNodes"]>[number]
  } | null>(null)

  const options = React.useMemo(() => {
    const list: SlashOption[] = []

    list.push(
      new SlashOption("Paragraph", () =>
        editor.update(() => {
          const sel = $getSelection()
          if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createParagraphNode())
        }),
      ),
    )

    for (const lvl of manifest.blockTypes.heading?.levels ?? []) {
      const capturedLvl = lvl
      list.push(
        new SlashOption(`Heading ${capturedLvl}`, () =>
          editor.update(() => {
            const sel = $getSelection()
            if ($isRangeSelection(sel))
              $setBlocksType(sel, () => $createHeadingNode(`h${capturedLvl}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"))
          }),
        ),
      )
    }

    if (manifest.blockTypes.bulletList)
      list.push(
        new SlashOption("Bullet list", () =>
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
        ),
      )

    if (manifest.blockTypes.orderedList)
      list.push(
        new SlashOption("Numbered list", () =>
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
        ),
      )

    if (manifest.blockTypes.blockquote)
      list.push(
        new SlashOption("Quote", () =>
          editor.update(() => {
            const sel = $getSelection()
            if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createQuoteNode())
          }),
        ),
      )

    for (const tn of manifest.themedNodes ?? []) {
      const capturedTn = tn
      list.push(new SlashOption(capturedTn.label, () => setPending({ def: capturedTn })))
    }

    return list
  }, [manifest, editor])

  const insertThemed = (
    def: NonNullable<RtManifest["themedNodes"]>[number],
    props: Record<string, unknown>,
  ) => {
    editor.update(() => {
      const sel = $getSelection()
      if (!$isRangeSelection(sel)) return
      const themed = $createThemedNode(def.id, props, !!def.container)
      sel.insertNodes([themed])
    })
    setPending(null)
  }

  return (
    <>
      <LexicalTypeaheadMenuPlugin<SlashOption>
        triggerFn={triggerMatch}
        onQueryChange={() => {}}
        options={options}
        onSelectOption={(opt, _node, closeMenu) => {
          opt.onSelect()
          closeMenu()
        }}
        menuRenderFn={(anchorRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => {
          if (!anchorRef.current) return null
          // Lift the Lexical anchor above any siblings: the anchor is
          // position:absolute by default but z-index:auto, so it stacks
          // wherever its document position lands — frequently behind sticky
          // editor chrome, preview panes, sibling block cards, etc. Set a
          // high z-index here so the menu wins; the wrapper inside also gets
          // position:relative so its own `z-50` is honored (z-index has no
          // effect on static-positioned elements).
          anchorRef.current.style.zIndex = "9999"
          return createPortal(
            <div
              role="listbox"
              className="rt-slashmenu relative z-50 min-w-[14rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-black/5"
              data-siab-editor-ui
              data-siab-canvas-chrome="rich-text-slash-menu"
            >
              {options.length === 0 ? (
                <div className="px-2.5 py-1.5 text-xs text-muted-foreground">{t("noMatches")}</div>
              ) : (
                options.map((o, i) => {
                  const active = i === selectedIndex
                  return (
                    <button
                      key={o.key}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={[
                        "flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm outline-none transition-colors",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground hover:bg-accent/60 hover:text-accent-foreground",
                      ].join(" ")}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      onClick={() => selectOptionAndCleanUp(o)}
                    >
                      <span className="flex-1 truncate">{o.title}</span>
                    </button>
                  )
                })
              )}
            </div>,
            anchorRef.current,
          )
        }}
      />
      {pending && (
        <ThemedNodeDialog
          def={pending.def}
          initial={{}}
          onCancel={() => setPending(null)}
          onSubmit={(props) => insertThemed(pending.def, props)}
        />
      )}
    </>
  )
}
