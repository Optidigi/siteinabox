export type BuilderSpeechPart = { kind: "text" | "strong"; value: string }

/** Tiny chat subset: render leftover **bold** so model markdown does not show as source. */
export const splitBuilderSpeech = (text: string): BuilderSpeechPart[] => {
  if (!text) return []
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((part) => part.length > 0)
    .map((part) => {
      const match = /^\*\*([^*]+)\*\*$/.exec(part)
      return match?.[1]
        ? { kind: "strong" as const, value: match[1] }
        : { kind: "text" as const, value: part }
    })
}
