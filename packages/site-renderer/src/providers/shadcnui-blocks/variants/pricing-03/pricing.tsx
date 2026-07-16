// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
"use client";
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import NumberFlow from "@number-flow/react";
import { CircleCheck, CircleHelp } from "lucide-react";
import { useState } from "react";
import { cn } from "@siteinabox/ui/lib/utils";
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Separator } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Tabs, TabsList, TabsTrigger } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

const tooltipContent = {
  styles: "Choose from a variety of styles to suit your preferences.",
  filters: "Choose from a variety of filters to enhance your portraits.",
  credits: "Use these credits to retouch your portraits.",
};

const YEARLY_DISCOUNT = 20;
const plans = [
  {
    name: "Starter",
    price: 20,
    description:
      "Get 20 AI-generated portraits with 2 unique styles and filters.",
    features: [
      { title: "5 hours turnaround time" },
      { title: "20 AI portraits" },
      { title: "Choice of 2 styles", tooltip: tooltipContent.styles },
      { title: "Choice of 2 filters", tooltip: tooltipContent.filters },
      { title: "2 retouch credits", tooltip: tooltipContent.credits },
    ],
    buttonText: "Get 20 portraits in 5 hours",
  },
  {
    name: "Advanced",
    price: 40,
    isRecommended: true,
    description:
      "Get 50 AI-generated portraits with 5 unique styles and filters.",
    features: [
      { title: "3 hours turnaround time" },
      { title: "50 AI portraits" },
      { title: "Choice of 5 styles", tooltip: tooltipContent.styles },
      { title: "Choice of 5 filters", tooltip: tooltipContent.filters },
      { title: "5 retouch credits", tooltip: tooltipContent.credits },
    ],
    buttonText: "Get 50 portraits in 3 hours",
    isPopular: true,
  },
  {
    name: "Premium",
    price: 80,
    description:
      "Get 100 AI-generated portraits with 10 unique styles and filters.",
    features: [
      { title: "1-hour turnaround time" },
      { title: "100 AI portraits" },
      { title: "Choice of 10 styles", tooltip: tooltipContent.styles },
      { title: "Choice of 10 filters", tooltip: tooltipContent.filters },
      { title: "10 retouch credits", tooltip: tooltipContent.credits },
    ],
    buttonText: "Get 100 portraits in 1 hour",
  },
];

const Pricing = () => {
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState("monthly");

  return (
    <div className="px-6 py-20">
      <h2 className="text-center font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]"><ProviderField field="title" fallback={<>
        Our Plans
      </>} inline /></h2>
      <p className="mt-3 text-center text-muted-foreground text-xl -tracking-[0.01em] md:text-2xl"><ProviderField field="intro" fallback={<>
        Choose the plan that fits your needs
      </>} inline /></p>

      <Tabs
        className="mx-auto mt-8 max-w-max"
        onValueChange={setSelectedBillingPeriod}
        value={selectedBillingPeriod}
      >
        <TabsList className="h-11 rounded-full">
          <TabsTrigger
            className="rounded-full px-4 data-[state=active]:shadow-none"
            value="monthly"
          >
            Monthly
          </TabsTrigger>
          <TabsTrigger
            className="rounded-full px-4 data-[state=active]:shadow-none"
            value="yearly"
          >
            Yearly (Save {YEARLY_DISCOUNT}%)
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="mx-auto mt-12 grid max-w-(--breakpoint-lg) grid-cols-1 items-center gap-8 lg:grid-cols-3">
        {<ProviderItems field="plans" templates={plans}>{(providerItems) => providerItems.map((plan) => (
          <div
            className={cn("relative rounded-xl border p-6", {
              "border-2 border-primary py-10": plan.isPopular,
            })}
            key={plan.name}
          >
            {plan.isPopular && (
              <Badge className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2">
                Most Popular
              </Badge>
            )}
            <h3 className="font-medium text-lg">{plan.name}</h3>
            <p className="mt-4 font-semibold text-4xl">
              <NumberFlow
                className="font-satoshi"
                prefix="$"
                value={
                  selectedBillingPeriod === "monthly"
                    ? plan.price
                    : plan.price * ((100 - YEARLY_DISCOUNT) / 100)
                }
              />
              <span className="ml-1.5 font-normal text-muted-foreground text-sm">
                /month
              </span>
            </p>
            <p className="mt-4 text-muted-foreground text-sm">
              {plan.description}
            </p>

            <Button
              className="mt-6 w-full"
              size="lg"
              variant={plan.isPopular ? "default" : "outline"}
            >
              {plan.buttonText}
            </Button>
            <Separator className="my-8" />
            <ul className="space-y-2">
              {plan.features.map((feature) => (
                <li className="flex items-start gap-1.5" key={feature.title}>
                  <CircleCheck className="mt-1 h-4 w-4 text-success" />
                  {feature.title}
                  {feature.tooltip && (
                    <Tooltip>
                      <TooltipTrigger aria-label="More information" className="cursor-help">
                        <CircleHelp className="mt-1 h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>{feature.tooltip}</TooltipContent>
                    </Tooltip>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}</ProviderItems>}
      </div>
    </div>
  );
};

export default Pricing;
