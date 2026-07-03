"use client"

import * as React from "react"

/** Live `contentDocument` of the page editor iframe, when ready. */
export const EditorFrameDocumentContext = React.createContext<Document | null>(null)
