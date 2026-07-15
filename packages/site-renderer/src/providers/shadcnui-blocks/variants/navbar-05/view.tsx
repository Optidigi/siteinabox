import * as React from "react"
import Literal from "./literal"
import { LiteralProviderNavbarView } from "../../runtime/chrome-literal-view"
import type { NavbarViewModel } from "../../runtime/navbar"
export default function View({ model }: { model: NavbarViewModel }) { return <LiteralProviderNavbarView Literal={Literal} model={model} variant="shadcnui-blocks.navbar-05" /> }
