"use client"
import * as React from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { Pencil } from "lucide-react"
import { $getNodeByKey } from "lexical"
import { useRtManifest } from "@/components/forms/PageForm"
import { ThemedNodeDialog } from "@/components/editor/richText/toolbar/themed-node-dialog"
import { $isThemedNode, registerThemedPill } from "@/lib/richText/lexical/ThemedNode"

export interface ThemedPillProps {
  id: string
  props: Record<string, unknown>
  nodeKey?: string
}

/**
 * In-editor representation of a themed node.
 *
 * Two render modes:
 *   1. "inline-text" — for themed nodes whose only field is a single text
 *      value (e.g. eyebrow). Renders the value with the themed visual
 *      treatment so editors see roughly what visitors will see. The span
 *      is contentEditable: click and type directly, no pencil/dialog.
 *   2. "pill"        — for themed nodes with multiple / non-text fields
 *      (e.g. callout with variant + body). Compact pill UI with label,
 *      first-field summary, and edit button. Used as the fallback.
 */
export const ThemedPill: React.FC<ThemedPillProps> = ({ id, props, nodeKey }) => {
  const [editor] = useLexicalComposerContext()
  const manifest = useRtManifest()
  const def = manifest.themedNodes?.find((n) => n.id === id)
  const [open, setOpen] = React.useState(false)

  const save = (next: Record<string, unknown>) => {
    if (!nodeKey) return
    editor.update(() => {
      const n = $getNodeByKey(nodeKey)
      if (n && $isThemedNode(n)) n.setProps(next)
    })
    setOpen(false)
  }

  // Detect "single text field" themed nodes — they render in-editor as the
  // actual styled text (more WYSIWYG), not a compact pill.
  const firstField = def?.fields[0]
  const isInlineText =
    def != null &&
    def.fields.length === 1 &&
    firstField != null &&
    firstField.type === "text" &&
    typeof props[firstField.name] === "string"

  // Compact editor-only treatment for known text-only themed nodes. Exact site
  // typography remains visible in the adjacent shared renderer.
  const themedTextClass: Record<string, string> = {
    eyebrow: "inline-block -rotate-2 text-[20px] text-accent [font-family:var(--font-script,ui-serif,Georgia,serif)]",
  }

  if (isInlineText && firstField) {
    const text = String(props[firstField.name] ?? "")
    const fieldName = firstField.name

    return (
      <InlineTextPill
        id={id}
        text={text}
        fieldName={fieldName}
        nodeKey={nodeKey}
        className={themedTextClass[id] ?? "italic text-accent"}
        defLabel={def.label}
        onCommit={(newText) => {
          if (!nodeKey) return
          editor.update(() => {
            const n = $getNodeByKey(nodeKey)
            if (n && $isThemedNode(n)) n.setProps({ ...n.getProps(), [fieldName]: newText })
          })
        }}
      />
    )
  }

  // Pill fallback for multi-field / complex themed nodes
  const summary = def?.fields[0]?.name && typeof props[def.fields[0].name] === "string"
    ? String(props[def.fields[0].name]).slice(0, 60)
    : ""

  const dialog = open && def && (
    <ThemedNodeDialog
      def={def}
      initial={props}
      onCancel={() => setOpen(false)}
      onSubmit={save}
    />
  )

  return (
    <span className="my-1 inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-sm">
      <span className="font-medium">{def?.label ?? id}</span>
      {summary && <span className="text-muted-foreground truncate max-w-[16rem]">· {summary}</span>}
      <button
        type="button"
        aria-label={`Edit ${def?.label ?? id}`}
        onClick={() => setOpen(true)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-sm hover:bg-accent/40"
      >
        <Pencil className="size-3" />
      </button>
      {dialog}
    </span>
  )
}

// Self-register so Lexical's ThemedNode.decorate() can find this component.
// Module side-effect: importing ThemedPill registers it.
registerThemedPill(ThemedPill)

// ---------------------------------------------------------------------------
// InlineTextPill — extracted to its own component so the ref + effect pattern
// has a stable identity and doesn't get entangled with the outer ThemedPill
// render cycle.
// ---------------------------------------------------------------------------

interface InlineTextPillProps {
  id: string
  text: string
  fieldName: string
  nodeKey: string | undefined
  className: string
  defLabel: string
  onCommit: (text: string) => void
}

const InlineTextPill: React.FC<InlineTextPillProps> = ({
  id,
  text,
  className,
  defLabel,
  onCommit,
}) => {
  const spanRef = React.useRef<HTMLSpanElement>(null)

  // Cursor-jump guard: only push the external value into the DOM when it
  // genuinely differs from what's already there (i.e. on first mount or an
  // external / programmatic update — NOT on every keystroke that triggered the
  // re-render). This prevents React from clobbering the user's in-progress
  // edit position.
  React.useEffect(() => {
    const el = spanRef.current
    if (el && el.textContent !== text) {
      el.textContent = text
    }
  }, [text])

  const handleInput = (e: React.FormEvent<HTMLSpanElement>) => {
    const newText = e.currentTarget.textContent ?? ""
    onCommit(newText)
  }

  return (
    <span
      ref={spanRef}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-label={defLabel}
      className={className}
      data-rt-id={id}
      onInput={handleInput}
      // Stop pointer/keyboard events from bubbling into the Lexical editor
      // host so Lexical doesn't misinterpret clicks/selections as editor-level
      // selection events while the user is typing inside the decorator.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      // Do NOT render text as a React child — that fights the contentEditable
      // DOM and would reset the cursor on every keystroke. The ref+effect above
      // seeds the initial value and syncs only on genuine external changes.
    />
  )
}
