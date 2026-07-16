// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
"use client";
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import type { ComponentProps } from "react";
import type { LinkRef } from "@siteinabox/contracts";
import { useProviderBlockModel } from "../../runtime/content";
import { Area, AreaChart } from "recharts";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { type ChartConfig, ChartContainer } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { cn } from "@siteinabox/ui/lib/utils";

const data = [
  {
    revenue: 10_400,
    subscription: 40,
  },
  {
    revenue: 14_405,
    subscription: 90,
  },
  {
    revenue: 9400,
    subscription: 200,
  },
  {
    revenue: 8200,
    subscription: 278,
  },
  {
    revenue: 7000,
    subscription: 89,
  },
  {
    revenue: 9600,
    subscription: 239,
  },
  {
    revenue: 11_244,
    subscription: 78,
  },
  {
    revenue: 26_475,
    subscription: 89,
  },
];

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--primary)",
  },
  subscription: {
    label: "Subscriptions",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

export function StatsCard({
  className,
  value,
  label,
  action,
  ...props
}: ComponentProps<typeof Card> & { value?: string; label?: string; action?: LinkRef }) {
  const model = useProviderBlockModel();
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-none rounded-tl-xl border-border/60 border-r-0 border-b-0 pb-0 shadow-none lg:hidden xl:flex",
        className
      )}
      {...props}
    >
      <CardHeader>
        <CardTitle className="font-satoshi text-3xl">{model ? value : "+2,350"}</CardTitle>
        <CardDescription>{model ? label : "+180.1% from last month"}</CardDescription>
        {model ? action?.href && action.label ? <CardAction><ProviderDemoOnly fallback={<><Button size="sm" variant="ghost" asChild><a href={action.href} target={action.external ? "_blank" : undefined} rel={action.external ? "noreferrer" : undefined}>{action.label}</a></Button></>} /></CardAction> : null : <CardAction><ProviderDemoOnly fallback={<><Button size="sm" variant="ghost">View More</Button></>} /></CardAction>}
      </CardHeader>
      <CardContent className="mt-auto flex-1 p-0">
        <ChartContainer className="size-full max-h-28" config={chartConfig}>
          <AreaChart
            data={data}
            margin={{
              left: 0,
              right: 0,
            }}
          >
            <Area
              dataKey="subscription"
              fill="var(--color-subscription)"
              fillOpacity={0.05}
              stroke="var(--color-subscription)"
              strokeWidth={2}
              type="monotone"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
