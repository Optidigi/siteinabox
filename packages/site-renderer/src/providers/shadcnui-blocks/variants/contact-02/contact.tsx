// Owned typed adaptation of upstream shadcnui-blocks contact-02 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot, SiteSettings } from "@siteinabox/contracts"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input, Label, Textarea } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { contact02CmsLike } from "../../typed/fixtures/contact-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderContactFieldLabel,
  renderContactSectionDescription,
  renderContactSectionTitle,
  renderContactSubmitLabel,
  resolveRuntimeContactDetails,
  type ContactSectionField,
} from "../../typed/contact-section-fields"

export type Contact02Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  description?: RtRoot | null
  formName: string
  submitLabel?: string | null
  fields: ContactSectionField[]
  formAction?: string
  siteSettings?: SiteSettings
}

export function Contact02({
  title,
  description,
  formName,
  submitLabel,
  fields,
  formAction,
  siteSettings,
  blockIndex,
  editSlots,
  rootAttributes,
}: Contact02Props) {
  const titleContent = renderContactSectionTitle(editSlots, title, blockIndex)
  const descriptionContent = renderContactSectionDescription(editSlots, description, blockIndex)
  const details = resolveRuntimeContactDetails(siteSettings)

  return (
    <div className="py-20" {...rootAttributes}>
      <div className="mx-auto w-full max-w-(--breakpoint-xl) px-6 xl:px-0">
        <b className="font-medium text-muted-foreground text-sm uppercase tracking-wide">Contact Us</b>
        {titleContent ? <h2 className="mt-3 font-medium text-4xl tracking-[-0.035em]">{titleContent}</h2> : null}
        {descriptionContent ? (
          <p className="mt-3 text-lg text-muted-foreground md:text-xl">{descriptionContent}</p>
        ) : null}
        <div className="mt-16 flex flex-col gap-16 md:gap-10 lg:flex-row">
          {details.length ? (
            <div className="grid w-full max-w-3xl grid-cols-1 gap-1 rounded-xl border bg-muted p-1 *:rounded-lg *:border *:bg-background *:p-6 sm:grid-cols-2 lg:col-span-2 dark:*:border-foreground/20">
              {details.map(({ title: detailTitle, description: detailDescription, value, href, Icon }) => (
                <div key={detailTitle}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-foreground/3 bg-foreground/5 text-foreground dark:border-foreground/20 dark:bg-foreground/10">
                    <Icon />
                  </div>
                  <h3 className="mt-6 font-medium text-xl">{detailTitle}</h3>
                  <p className="my-2.5 text-muted-foreground">{detailDescription}</p>
                  {href ? (
                    <a className="font-medium text-primary" href={href}>{value}</a>
                  ) : (
                    <span className="font-medium text-primary">{value}</span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
          <div className="w-full max-w-lg rounded-xl border bg-muted p-1">
            <Card className="relative isolate rounded-lg bg-background shadow-none lg:ms-auto dark:border-foreground/20">
              <CardHeader className="gap-1">
                <CardTitle className="font-medium text-xl">{formName}</CardTitle>
                <CardDescription className="text-base">
                  {description ? "Fill out the form and we will get back to you." : "Send us a message."}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-2">
                <form action={formAction} method="post">
                  <input type="hidden" name="formName" value={formName} />
                  <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
                    {fields.map((field, index) => (
                      <div
                        key={field.name}
                        className={
                          field.type === "textarea" || field.type === "select" || field.type === "checkbox"
                            ? "col-span-2"
                            : "col-span-2 sm:col-span-1"
                        }
                      >
                        {field.type === "checkbox" ? (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              className="bg-background"
                              id={field.name}
                              name={field.name}
                              required={field.required}
                            />
                            <Label className="gap-0" htmlFor={field.name}>
                              {renderContactFieldLabel(editSlots, field.label, blockIndex, index)}
                            </Label>
                          </div>
                        ) : (
                          <>
                            <Label htmlFor={field.name}>
                              {renderContactFieldLabel(editSlots, field.label, blockIndex, index)}
                            </Label>
                            {field.type === "textarea" ? (
                              <Textarea
                                className="mt-2 bg-[var(--provider-surface,#fff)] shadow-none"
                                id={field.name}
                                name={field.name}
                                placeholder={field.placeholder ?? undefined}
                                required={field.required}
                                rows={6}
                                maxLength={field.maxLength ?? undefined}
                              />
                            ) : field.type === "select" ? (
                              <select
                                className="mt-2 h-10 w-full rounded-md border bg-[var(--provider-surface,#fff)] px-3 shadow-none"
                                id={field.name}
                                name={field.name}
                                required={field.required}
                              >
                                {field.options?.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            ) : (
                              <Input
                                className="mt-2 bg-[var(--provider-surface,#fff)] shadow-none"
                                id={field.name}
                                name={field.name}
                                placeholder={field.placeholder ?? undefined}
                                required={field.required}
                                type={field.type}
                                maxLength={field.maxLength ?? undefined}
                              />
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button className="mt-6 w-full" size="lg" type="submit">
                    {renderContactSubmitLabel(editSlots, submitLabel || "Submit", blockIndex)}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Contact02Literal() {
  return (
    <Contact02
      title={contact02CmsLike.title}
      description={contact02CmsLike.description}
      formName={contact02CmsLike.formName}
      submitLabel={contact02CmsLike.submitLabel}
      fields={contact02CmsLike.fields}
      blockIndex={0}
    />
  )
}
