import * as React from "react"
import Literal from "./literal"
import { LiteralProviderBannerView } from "../../runtime/chrome-literal-view"
import type { BannerViewModel } from "../../runtime/banner"
export default function View({ model }: { model: BannerViewModel }) { return <LiteralProviderBannerView Literal={Literal} model={model} variant="shadcnui-blocks.banner-01" /> }
