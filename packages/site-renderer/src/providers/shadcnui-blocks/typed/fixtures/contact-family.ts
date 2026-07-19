import { previewBlockText, previewInlineText } from "../fixtures"
import type { ContactDetailsItem } from "../contact-details-fields"

export const contactItem = (
  title: string,
  description: string,
  value: string,
  icon: string,
  href?: string,
): ContactDetailsItem => ({
  title,
  description,
  value,
  icon,
  href: href ?? null,
})

export const contact01Items = [
  contactItem("Email", "Our friendly team is here to help.", "hello@example.test", "mail", "mailto:hello@example.test"),
  contactItem("Office", "Come say hello at our office HQ.", "100 Smith Street", "map-pin", "https://maps.example.test"),
  contactItem("Phone", "Mon-Fri from 8am to 5pm.", "+1 (555) 000-0000", "phone", "tel:+15550000000"),
]

export const contact03Items = [
  contactItem("Email", "Our friendly team is here to help.", "hello@example.test", "mail", "mailto:hello@example.test"),
  contactItem("Live chat", "Our friendly team is here to help.", "Start new chat", "message", "https://example.test/chat"),
  contactItem("Office", "Come say hello at our office HQ.", "100 Smith Street", "map-pin", "https://maps.example.test"),
  contactItem("Phone", "Mon-Fri from 8am to 5pm.", "+1 (555) 000-0000", "phone", "tel:+15550000000"),
]

export const contactFamilyCmsLike = {
  title: previewInlineText("Get In Touch"),
  description: previewBlockText("Our friendly team is always here to chat"),
  items: contact01Items,
}

export const contactFamilySparse = {
  items: [contactItem("Email", "Reach us anytime.", "hello@example.test", "mail")],
}

export const contactFamilyLong = {
  title: previewInlineText("A".repeat(500)),
  description: previewBlockText("B".repeat(500)),
  items: [contactItem("C".repeat(100), "D".repeat(200), "E".repeat(100), "mail")],
}

export const contactFamilyEmptyItems = {
  title: previewInlineText("Contact"),
  description: previewBlockText("No contact methods yet"),
  items: [] as ContactDetailsItem[],
}

export const contact01CmsLike = contactFamilyCmsLike

export const contact03CmsLike = {
  title: previewInlineText("We'd love to hear from you"),
  description: previewBlockText("Our friendly team is always here to chat."),
  items: contact03Items,
}

export const contact02CmsLike = {
  title: previewInlineText("Chat with our friendly team!"),
  description: previewBlockText("We'd love to hear from you. Please fill out this form or shoot us an email."),
  formName: "Contact Us",
  submitLabel: "Submit",
  fields: [
    { name: "firstName", label: "First Name", type: "text" as const, placeholder: "First name", required: true },
    { name: "lastName", label: "Last Name", type: "text" as const, placeholder: "Last name", required: true },
    { name: "email", label: "Email", type: "email" as const, placeholder: "Email", required: true },
    { name: "message", label: "Message", type: "textarea" as const, placeholder: "Message", required: true },
  ],
}
