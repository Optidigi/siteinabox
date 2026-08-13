import { CircleHelp, Check, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { SITE_IN_A_BOX_PRODUCT } from '@siteinabox/contracts';
import { captureLandingEvent } from '@/lib/landing-analytics';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const { monthlyEur, yearlyEur } = SITE_IN_A_BOX_PRODUCT.pricing;
const yearlySavingsEur = monthlyEur * 12 - yearlyEur;

const features = [
  ['Professionele website', 'Homepage en contactpagina, met je bedrijfsinfo, diensten en een duidelijke call-to-action.'],
  ['Klaar voor Google én ChatGPT', 'Je website wordt gevonden door zoekmachines én door AI-tools die mensen voor advies gebruiken.'],
  ['Bliksemsnelle laadtijd'],
  ['Veilig en betrouwbaar online'],
  ['.nl-domein eerste jaar gratis', 'Nieuw .nl-domein op jouw naam: het eerste jaar gratis. Daarna verlengingskosten. Of we koppelen je huidige domein.'],
  ['Zelf teksten en foto’s aanpassen'],
  ['NL-support'],
  ['Zakelijke e-mail', 'Een zakelijk adres zoals info@jouwbedrijf.nl. Ontvangen én versturen vanaf je eigen domein.'],
] as const;

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        delay={0}
        className="relative ml-1 inline-grid size-4 shrink-0 place-items-center text-muted-foreground after:absolute after:-inset-3 hover:text-foreground"
        aria-label={`Meer info: ${text}`}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <CircleHelp className="size-4" aria-hidden />
      </TooltipTrigger>
      <TooltipContent className="w-64 p-3 leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

function Plan({ yearly, intakeHref }: { yearly: boolean; intakeHref: string }) {
  return (
    <Card className={cn(
      'relative mx-auto w-full max-w-[560px] overflow-visible border-black bg-white px-5 pb-12 pt-7 text-black shadow-[6px_6px_0_#090709] dark:bg-card dark:text-white lg:px-[35px] lg:pb-[70px] lg:pt-10',
      yearly && 'shadow-[10px_10px_0_#090709]',
    )}>
      {yearly && <Badge className="absolute -top-4 right-6 h-auto px-3.5 py-1.5 font-bold shadow-sm">VOORDELIGST</Badge>}
      <div className="text-center">
        <p className="font-head text-[32px] font-medium tracking-[-.02em] sm:text-[36px] min-[1400px]:text-[42px]">Site in a Box</p>
        <p className="mt-1.5 text-base text-black/60 dark:text-white">Jouw bedrijfswebsite, helemaal verzorgd</p>
        <p className="mx-auto mt-5 flex min-h-11 max-w-sm items-center justify-center bg-[#eaf5fc] px-3 font-head text-base font-medium text-black dark:border-2 dark:border-black dark:bg-plum dark:text-white min-[1400px]:mt-10 min-[1400px]:text-xl">{yearly ? `Je bespaart €${yearlySavingsEur} per jaar` : 'Maandelijks opzegbaar'}</p>
        <p className="my-4 flex items-baseline justify-center whitespace-nowrap font-head text-[56px] font-semibold tracking-[-.03em] sm:text-[64px] min-[1200px]:text-[72px] min-[1400px]:text-[80px]">
          €{yearly ? yearlyEur : monthlyEur}<span className="ml-1 text-xl tracking-normal min-[1400px]:text-2xl">/{yearly ? 'jaar' : 'maand'}</span>
        </p>
      </div>
      <a
        href={intakeHref}
        data-analytics-component="cta-start-intake-pricing"
        data-analytics-component-type="cta"
        data-analytics-component-role="primary"
        data-analytics-action="start_intake"
        data-analytics-placement="pricing"
        data-analytics-destination="intake"
        data-analytics-conversion="true"
        data-analytics-conversion-source="intake_handoff"
        className={cn(
          buttonVariants({ variant: 'secondary', size: 'lg' }),
          'min-h-[60px] w-full justify-between bg-black px-5 text-white hover:bg-yellow hover:text-black dark:bg-yellow dark:text-black dark:hover:bg-primary-hover',
        )}
      >
        Start vrijblijvend<span className="grid size-9 place-items-center rounded-full bg-yellow text-black dark:bg-black dark:text-yellow"><ChevronRight className="size-5" aria-hidden /></span>
      </a>
      <h3 className="mb-8 mt-10 border-b-2 border-border pb-6 text-[22px] font-medium min-[1400px]:mb-[45px] min-[1400px]:mt-[65px] min-[1400px]:text-2xl">Inbegrepen</h3>
      <ul className="grid gap-5 text-base font-medium min-[1400px]:text-lg min-[1400px]:leading-[27px]">
        {features.map(([label, tip], index) => (
          <li key={label} className={cn('flex min-h-5 items-center gap-2 dark:text-white/70', index === features.length - 1 && 'text-black/65 dark:text-white/55')}>
            <span className="grid size-5 shrink-0 place-items-center">
              {index === features.length - 1
                ? <Plus className="size-[18px]" strokeWidth={2.5} aria-hidden />
                : <Check className="size-[18px]" strokeWidth={2.5} aria-hidden />}
            </span>
            <span className="leading-tight">{label}</span>
            {tip && <InfoTooltip text={tip} />}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PricingTabs({ intakeHref }: { intakeHref: string }) {
  const [yearly, setYearly] = useState(false);
  const selectBillingPeriod = (nextYearly: boolean) => {
    if (yearly === nextYearly) return;
    setYearly(nextYearly);
    captureLandingEvent('site_journey_step', {
      journey_name: 'pricing',
      journey_step: 'select_billing_period',
      billing_period: nextYearly ? 'yearly' : 'monthly',
      interaction_type: 'select',
    });
  };

  return (
    <TooltipProvider>
      <div className="site-container grid max-w-[1180px] items-start gap-12 lg:grid-cols-[minmax(0,1fr)_560px] lg:gap-20">
        <div className="pt-4 text-center lg:text-left">
          <h2 id="prijzen-heading" className="mx-auto max-w-xl text-5xl leading-[.95] text-balance md:text-[68px] md:leading-[1.1] lg:mx-0">Eén prijs. Alles inbegrepen.</h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-foreground/75 md:text-xl md:leading-[1.75] lg:mx-0">Eén ding minder om te regelen voor je nieuwe bedrijf.<br className="hidden xl:block" /> Wij doen de techniek, jij houdt je bezig met je klanten.</p>
          <p className="mb-3 mt-10 text-lg font-medium md:mt-[55px] md:text-xl">Facturatie</p>
          <div className="flex min-h-14 items-center justify-center gap-3 lg:justify-start" role="group" aria-label="Facturatieperiode">
            <button
              type="button"
              aria-pressed={!yearly}
              onClick={() => selectBillingPeriod(false)}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center font-head text-base font-bold transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                yearly && 'text-muted-foreground',
              )}
            >
              Maandelijks
            </button>
            <Switch size="lg" checked={yearly} onCheckedChange={selectBillingPeriod} aria-label="Jaarlijkse facturatie" />
            <button
              type="button"
              aria-pressed={yearly}
              onClick={() => selectBillingPeriod(true)}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center gap-2 font-head text-base font-bold transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                !yearly && 'text-muted-foreground',
              )}
            >
              Jaarlijks <Badge className="h-6 px-2 py-0 font-bold leading-none shadow-sm">−17%</Badge>
            </button>
          </div>
          <p className="mt-3 text-sm text-foreground/60 dark:text-white/55">Alle prijzen excl. btw</p>
        </div>
        <div className="lg:col-start-2 lg:row-start-1"><Plan yearly={yearly} intakeHref={intakeHref} /></div>
      </div>
    </TooltipProvider>
  );
}
