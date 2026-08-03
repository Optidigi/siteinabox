import { useEffect, useState } from 'react';
import { Menu, Moon, Sun } from 'lucide-react';
import { buttonVariants, Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type NavItem = { label: string; href: string };

type Props = {
  nav: NavItem[];
  intakeHref: string;
  loginHref: string;
};

export function SiteHeader({ nav, intakeHref, loginHref }: Props) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    const syncScrolled = () => setScrolled(window.scrollY >= 180);
    window.addEventListener('scroll', syncScrolled, { passive: true });
    syncScrolled();
    return () => window.removeEventListener('scroll', syncScrolled);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('siab-theme', next);
    } catch {}
    setTheme(next);
  };

  return (
    <header
      data-site-header
      data-scrolled={scrolled ? '' : undefined}
      className="fixed inset-x-0 top-0 z-40 border-b-2 border-transparent bg-background/95 transition-[background-color,border-color] data-[scrolled]:border-border"
    >
      <div className="mx-auto flex h-24 w-[calc(100%-24px)] max-w-none items-center gap-4 lg:grid lg:h-[104px] lg:grid-cols-[1fr_auto_1fr]">
        <a href="/" aria-label="Site in a Box — naar homepage" className="shrink-0 lg:justify-self-start" data-analytics-action="navigate_home" data-analytics-placement="header" data-analytics-destination="home">
          <img src="/theme/images/logo/siab_logo.svg" alt="Site in a Box" width="160" height="80" className="h-14 w-auto dark:hidden lg:h-[clamp(56px,calc(3vw+24px),72px)]" />
          <img src="/theme/images/logo/siab_logo_dark.svg" alt="Site in a Box" width="160" height="80" className="hidden h-14 w-auto dark:block lg:h-[clamp(56px,calc(3vw+24px),72px)]" />
        </a>

        <nav aria-label="Hoofdnavigatie" className="hidden lg:block lg:justify-self-center">
          <ul className="flex items-center gap-9">
            {nav.map((item) => (
              <li key={item.href}>
                <a className="font-body text-base font-semibold underline-offset-4 hover:border-b-2 hover:border-yellow" href={item.href} data-analytics-action={`navigate_${item.label.toLowerCase().replaceAll(' ', '_')}`} data-analytics-placement="header" data-analytics-destination={item.href.startsWith('#') || item.href.startsWith('/#') ? 'section' : 'page'}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-4 lg:justify-self-end">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={toggleTheme}
            data-analytics-action="toggle_theme"
            data-analytics-placement="header"
            data-analytics-destination="preference"
            aria-label={`Thema: ${theme === 'dark' ? 'donker (klik voor licht)' : 'licht (klik voor donker)'}`}
            className="size-11 bg-transparent shadow-none hover:bg-yellow hover:text-black"
          >
            {theme === 'dark' ? <Moon aria-hidden /> : <Sun aria-hidden />}
          </Button>
          <a className="inline-flex min-h-11 items-center font-body text-[15px] font-semibold underline decoration-dashed underline-offset-4 sm:text-base" href={loginHref} data-analytics-action="open_login" data-analytics-placement="header" data-analytics-destination="login">
            Inloggen
          </a>
          <a className={cn(buttonVariants({ size: 'lg' }), 'hidden min-h-12 px-[clamp(20px,1.4vw,26px)] py-[clamp(10px,.7vw,13px)] text-[clamp(15px,1vw,17px)] md:inline-flex')} href={intakeHref} data-analytics-component="cta-start-intake-header" data-analytics-component-type="cta" data-analytics-component-role="primary" data-analytics-action="start_intake" data-analytics-placement="header" data-analytics-destination="intake" data-analytics-conversion="true" data-analytics-conversion-source="intake_handoff">
            Start gratis
          </a>

          <Sheet>
            <SheetTrigger
              render={<Button variant="secondary" size="icon-lg" className="size-11 bg-black text-white lg:hidden dark:border-black dark:bg-card dark:text-foreground" />}
              aria-label="Open navigatie"
              data-analytics-action="open_mobile_menu"
              data-analytics-placement="header"
              data-analytics-destination="mobile_menu"
            >
              <Menu aria-hidden />
            </SheetTrigger>
            <SheetContent side="right" className="border-border bg-background p-0" aria-label="Mobiele navigatie">
              <SheetHeader className="border-b-2 border-border p-6">
                <SheetTitle className="text-2xl font-bold">Menu</SheetTitle>
                <SheetDescription>Ga direct naar een onderdeel van Site in a Box.</SheetDescription>
              </SheetHeader>
              <nav aria-label="Mobiele navigatie" className="p-6">
                <ul className="grid gap-3">
                  {nav.map((item) => (
                    <li key={item.href}>
                      <SheetClose
                        nativeButton={false}
                        render={<a className="block border-b-2 border-border py-4 font-head text-2xl font-bold" href={item.href} data-analytics-action={`navigate_${item.label.toLowerCase().replaceAll(' ', '_')}`} data-analytics-placement="mobile_menu" data-analytics-destination={item.href.startsWith('#') || item.href.startsWith('/#') ? 'section' : 'page'} />}
                      >
                        {item.label}
                      </SheetClose>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-auto grid gap-3 p-6">
                <SheetClose nativeButton={false} render={<a className={buttonVariants({ variant: 'outline', size: 'lg' })} href={loginHref} data-analytics-action="open_login" data-analytics-placement="mobile_menu" data-analytics-destination="login" />}>
                  Inloggen
                </SheetClose>
                <SheetClose nativeButton={false} render={<a className={buttonVariants({ size: 'lg' })} href={intakeHref} data-analytics-component="cta-start-intake-mobile-menu" data-analytics-component-type="cta" data-analytics-component-role="primary" data-analytics-action="start_intake" data-analytics-placement="mobile_menu" data-analytics-destination="intake" data-analytics-conversion="true" data-analytics-conversion-source="intake_handoff" />}>
                  Start gratis
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
