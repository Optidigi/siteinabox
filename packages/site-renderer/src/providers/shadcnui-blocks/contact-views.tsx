import * as React from "react"
import { MailIcon, MapPinIcon, MessageCircleIcon, PhoneIcon } from "lucide-react"
import type { Block } from "@siteinabox/contracts"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input, Label, Textarea } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { BlockRenderOptions } from "../../blocks/types"
import { ProviderBlockContent, ProviderField, type ProviderBlockModel } from "./runtime/content"
import { providerBlockAttributes } from "./runtime/block"

type FormBlock = Extract<Block, { blockType: "contactSection" }>
const editText = (model: ProviderBlockModel, field: string, value: string, itemIndex: number, subField: string) =>
  model.options.editSlots?.renderText?.({ name: `${model.block.blockType}.${field}.${subField}`, value, className: "contents", elementPath: { blockIndex: model.options.index, field, itemIndex, subField } }) ?? value

export function ShadcnUiContactView({ block, options, variant }: { block: FormBlock; options: BlockRenderOptions; variant: string }) {
  if (variant !== "shadcnui-blocks.contact-02") throw new Error(`Unresolved contact variant "${variant}".`)
  const model = { block, options }
  const settings = options.siteSettings
  const details = [
    settings?.contactEmail ? { title: "Email", description: "Our friendly team is here to help.", value: settings.contactEmail, href: `mailto:${settings.contactEmail}`, Icon: MailIcon } : null,
    settings?.contact?.social?.[0] ? { title: settings.contact.social[0].platform, description: "Start a conversation with our team.", value: settings.contact.social[0].platform, href: settings.contact.social[0].url, Icon: MessageCircleIcon } : null,
    settings?.contact?.address ? { title: "Office", description: "Come say hello at our office.", value: settings.contact.address, href: undefined, Icon: MapPinIcon } : null,
    settings?.contact?.phone ? { title: "Phone", description: "Call our team during opening hours.", value: settings.contact.phone, href: `tel:${settings.contact.phone}`, Icon: PhoneIcon } : null,
  ].filter(Boolean) as Array<{ title: string; description: string; value: string; href?: string; Icon: typeof MailIcon }>

  return <ProviderBlockContent model={model}>
    <div {...providerBlockAttributes(model, variant)} className="py-20">
      <div className="mx-auto w-full max-w-(--breakpoint-xl) px-6 xl:px-0">
        <b className="font-medium text-muted-foreground text-sm uppercase tracking-wide">Contact Us</b>
        <h2 className="mt-3 font-medium text-4xl tracking-[-0.035em]"><ProviderField field="title" fallback="Chat with our friendly team!" inline /></h2>
        <p className="mt-3 text-lg text-muted-foreground md:text-xl"><ProviderField field="description" fallback="We'd love to hear from you." inline /></p>
        <div className="mt-16 flex flex-col gap-16 md:gap-10 lg:flex-row">
          {details.length ? <div className="grid w-full max-w-3xl grid-cols-1 gap-1 rounded-xl border bg-muted p-1 *:rounded-lg *:border *:bg-background *:p-6 sm:grid-cols-2 lg:col-span-2 dark:*:border-foreground/20">
            {details.map(({ title, description, value, href, Icon }) => <div key={title}>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-foreground/3 bg-foreground/5 text-foreground dark:border-foreground/20 dark:bg-foreground/10"><Icon /></div>
              <h3 className="mt-6 font-medium text-xl">{title}</h3>
              <p className="my-2.5 text-muted-foreground">{description}</p>
              {href ? <a className="font-medium text-primary" href={href}>{value}</a> : <span className="font-medium text-primary">{value}</span>}
            </div>)}
          </div> : null}
          <div className="w-full max-w-lg rounded-xl border bg-muted p-1">
            <Card className="relative isolate rounded-lg bg-background shadow-none lg:ms-auto dark:border-foreground/20">
              <CardHeader className="gap-1">
                <CardTitle className="font-medium text-xl">{block.formName}</CardTitle>
                <CardDescription className="text-base">{block.description ? "Fill out the form and we will get back to you." : "Send us a message."}</CardDescription>
              </CardHeader>
              <CardContent className="mt-2">
                <form action={options.formAction} method="post">
                  <input type="hidden" name="formName" value={block.formName} />
                  <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
                    {block.fields.map((field, index) => <div key={field.name} className={field.type === "textarea" || field.type === "select" || field.type === "checkbox" ? "col-span-2" : "col-span-2 sm:col-span-1"}>
                      {field.type === "checkbox" ? <div className="flex items-center gap-2"><Checkbox className="bg-background" id={field.name} name={field.name} required={field.required} /><Label className="gap-0" htmlFor={field.name}>{editText(model, "fields", field.label, index, "label")}</Label></div> : <>
                        <Label htmlFor={field.name}>{editText(model, "fields", field.label, index, "label")}</Label>
                        {field.type === "textarea" ? <Textarea className="mt-2 bg-white shadow-none" id={field.name} name={field.name} placeholder={field.placeholder ?? undefined} required={field.required} rows={6} maxLength={field.maxLength ?? undefined} />
                          : field.type === "select" ? <select className="mt-2 h-10 w-full rounded-md border bg-white px-3 shadow-none" id={field.name} name={field.name} required={field.required}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                            : <Input className="mt-2 bg-white shadow-none" id={field.name} name={field.name} placeholder={field.placeholder ?? undefined} required={field.required} type={field.type} maxLength={field.maxLength ?? undefined} />}
                      </>}
                    </div>)}
                  </div>
                  <Button className="mt-6 w-full" size="lg" type="submit">{editText(model, "submitLabel", block.submitLabel || "Submit", 0, "submitLabel")}</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  </ProviderBlockContent>
}
