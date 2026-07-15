import * as React from "react"
import Literal from "./literal"
import { LiteralProviderFooterView } from "../../runtime/chrome-literal-view"
import type { FooterViewModel } from "../../runtime/footer"
export default function View({ model }: { model: FooterViewModel }) { return <LiteralProviderFooterView Literal={Literal} model={model} variant="shadcnui-blocks.footer-05" /> }
