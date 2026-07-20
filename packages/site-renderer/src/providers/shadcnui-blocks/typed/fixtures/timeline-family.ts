import type { TimelineItem } from "../timeline-fields"
import { timeline01Literal, timelineItem } from "./timeline-01"

export const timelineFamilyCmsLike = timeline01Literal

export const timelineFamilySparse = {
  items: [timelineItem("Only role", "Only company", "2024", "Single item", ["Tag"])],
}

export const timelineFamilyLong = {
  items: [timelineItem("A".repeat(200), "B".repeat(200), "C".repeat(50), "D".repeat(500), ["E".repeat(50)])],
}

export const timelineFamilyEmptyItems = {
  items: [] as TimelineItem[],
}

export const timeline05Step = (title: string, description: string): TimelineItem => ({
  title,
  description,
})

export const timeline05Literal = {
  items: [
    timeline05Step("Research", "Gather information and analyze requirements to understand the problem and define objectives."),
    timeline05Step("Planning", "Create a roadmap, define the scope, and outline the necessary steps to achieve the goal."),
    timeline05Step("Design", "Develop wireframes, mockups, and prototypes to visualize the structure and user experience."),
  ],
}

export const timeline06Step = (title: string, description: string, completed = false): TimelineItem => ({
  title,
  description,
  ...(completed ? { tags: [{ value: "completed" }] } : {}),
})

export const timeline06Literal = {
  items: [
    timeline06Step("Research", "Gather information and analyze requirements.", true),
    timeline06Step("Planning", "Create a roadmap and define the scope.", true),
    timeline06Step("Design", "Develop wireframes and prototypes.", false),
  ],
}

export const timeline07Entry = (
  title: string,
  description: string,
  version: string,
  date: string,
): TimelineItem => ({
  title,
  description,
  label: version,
  date,
})

export const timeline07Literal = {
  items: [
    timeline07Entry("Major Update: API Integration", "Integrated external APIs to enhance functionality.", "2.0.0", "2025-04-01"),
    timeline07Entry("New Components Added", "Introduced new UI components for better customization.", "1.4.0", "2025-03-22"),
    timeline07Entry("Initial Release", "Launched the first version with core features.", "1.0.0", "2025-03-01"),
  ],
}
