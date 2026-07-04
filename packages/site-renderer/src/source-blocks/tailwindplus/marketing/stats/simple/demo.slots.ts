import type { StatsBlock } from "@siteinabox/contracts"

export const tailwindPlusMarketingStatsSimpleDemoSlots = {
  blockType: "stats",
  designVariant: "tailwindPlusSimple",
  items: [
    {
      value: "44 million",
      label: "Transactions every 24 hours",
    },
    {
      value: "$119 trillion",
      label: "Assets under holding",
    },
    {
      value: "46,000",
      label: "New users annually",
    },
  ],
} satisfies StatsBlock
