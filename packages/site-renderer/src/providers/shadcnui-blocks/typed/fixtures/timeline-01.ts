import { previewInlineText } from "../fixtures"
import type { TimelineItem } from "../timeline-fields"

export const timelineItem = (
  title: string,
  label: string,
  date: string,
  description: string,
  tags: string[],
): TimelineItem => ({
  title,
  label,
  date,
  description,
  tags: tags.map((value) => ({ value })),
})

export const timeline01Literal = {
  items: [
    timelineItem(
      "Senior Full Stack Developer",
      "TechCorp Solutions",
      "2023 - Present",
      "Led the development of enterprise-scale web applications, mentored junior developers, and implemented best practices for code quality and performance optimization.",
      ["React", "Node.js", "TypeScript", "AWS", "MongoDB"],
    ),
    timelineItem(
      "Full Stack Developer",
      "Digital Innovations Inc",
      "2021 - 2023",
      "Developed and maintained multiple client projects, implemented responsive designs, and integrated third-party APIs for enhanced functionality.",
      ["React", "Express.js", "PostgreSQL", "Docker", "Redis"],
    ),
    timelineItem(
      "Frontend Developer",
      "WebTech Studios",
      "2018 - 2021",
      "Created responsive and interactive user interfaces, collaborated with designers, and optimized application performance.",
      ["React", "JavaScript", "SASS", "Webpack", "Jest"],
    ),
  ],
}
