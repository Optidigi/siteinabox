import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Faq01 } from "./variants/faq-01/faq.tsx"
import View from "./variants/faq-01/view.tsx"

globalThis.React = React

const inlineText = (text) => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: text }],
})

const blockText = (text) => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
})

const faqItem = (question, answer) => ({
  question: inlineText(question),
  answer: blockText(answer),
})

test("public render outputs accordion markup with rich text", () => {
  const html = renderToStaticMarkup(React.createElement(Faq01, {
    title: inlineText("Questions & Answers"),
    items: [
      faqItem("What is your return policy?", "You can return unused items within 30 days."),
      faqItem("How do I track my order?", "Use the link in your confirmation email."),
    ],
    blockIndex: 0,
  }))
  assert.match(html, /data-slot="accordion"/)
  assert.match(html, /data-slot="accordion-item"/)
  assert.match(html, /data-slot="accordion-trigger"/)
  assert.match(html, /data-slot="accordion-content"/)
  assert.match(html, />Questions &amp; Answers</)
  assert.match(html, />What is your return policy\?</)
  assert.match(html, />You can return unused items within 30 days\./)
  assert.match(html, />How do I track my order\?</)
})

test("sparse content omits optional title", () => {
  const html = renderToStaticMarkup(React.createElement(Faq01, {
    items: [faqItem("Only question?", "Only answer.")],
    blockIndex: 0,
  }))
  assert.doesNotMatch(html, /<h2/)
  assert.match(html, />Only question\?</)
  assert.match(html, />Only answer\./)
})

test("empty items renders accordion shell without items", () => {
  const html = renderToStaticMarkup(React.createElement(Faq01, {
    title: inlineText("FAQ"),
    items: [],
    blockIndex: 0,
  }))
  assert.match(html, /data-slot="accordion"/)
  assert.doesNotMatch(html, /data-slot="accordion-item"/)
})

test("long question and answer does not throw", () => {
  const long = "A".repeat(500)
  assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(Faq01, {
    title: inlineText(long),
    items: [faqItem(long, long)],
    blockIndex: 0,
  })))
})

test("editSlots use itemIndex for nested question and answer", () => {
  const called = []
  const html = renderToStaticMarkup(React.createElement(Faq01, {
    title: inlineText("Edit me"),
    items: [
      faqItem("First?", "First answer."),
      faqItem("Second?", "Second answer."),
    ],
    blockIndex: 3,
    editSlots: {
      renderRichText: ({ elementPath, name }) => {
        const suffix = elementPath.subField
          ? `${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`
          : elementPath.field
        called.push(`${name}:${suffix}`)
        return React.createElement("span", { "data-edit-rich": suffix })
      },
    },
  }))
  assert.deepEqual(
    new Set(called),
    new Set([
      "faq.title:title",
      "faq.items.question:items:0:question",
      "faq.items.answer:items:0:answer",
      "faq.items.question:items:1:question",
      "faq.items.answer:items:1:answer",
    ]),
  )
  assert.match(html, /data-edit-rich="title"/)
  assert.match(html, /data-edit-rich="items:0:question"/)
  assert.match(html, /data-edit-rich="items:0:answer"/)
  assert.match(html, /data-edit-rich="items:1:question"/)
})

test("accordion defaults to opening the first item", () => {
  const html = renderToStaticMarkup(React.createElement(Faq01, {
    items: [
      faqItem("First?", "First answer."),
      faqItem("Second?", "Second answer."),
    ],
    blockIndex: 0,
  }))
  const items = [...html.matchAll(/data-slot="accordion-item"/g)]
  assert.equal(items.length, 2)
  const firstItem = html.slice(items[0].index, items[1].index)
  const secondItem = html.slice(items[1].index)
  assert.match(firstItem, /data-state="open"/)
  assert.match(secondItem, /data-state="closed"/)
  assert.match(html, /aria-expanded="true"/)
  assert.match(html, /role="region"/)
})

test("view maps block to typed component with provider attributes", () => {
  const html = renderToStaticMarkup(React.createElement(View, {
    block: {
      blockType: "faq",
      title: inlineText("Help center"),
      items: [faqItem("Shipping?", "We ship worldwide.")],
    },
    options: { index: 2 },
  }))
  assert.match(html, /data-provider-variant="shadcnui-blocks\.faq-01"/)
  assert.match(html, /data-block-index="2"/)
  assert.match(html, />Help center</)
  assert.match(html, />Shipping\?</)
  assert.match(html, />We ship worldwide\./)
})
