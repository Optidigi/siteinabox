import * as React from "react"
import Literal from "./literal"
import { LiteralProviderVariantView, type ProviderBlockViewModel } from "../../runtime/literal-view"
export default function View({ model }: { model: ProviderBlockViewModel }) { return <LiteralProviderVariantView Literal={Literal} model={model} variant="shadcnui-blocks.stats-05" /> }
