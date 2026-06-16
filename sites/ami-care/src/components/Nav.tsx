/** @jsxImportSource react */
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export type NavProps = {
  brand?: string | null;
  logoUrl?: string | null;
  links?: Array<{ label: string; href: string }> | null;
};

const DEFAULT_BRAND = 'Amicare-Zorg';
const DEFAULT_LINKS: { label: string; href: string }[] = [
  { label: 'Werkwijze', href: '#werkwijze' },
  { label: 'Over', href: '#over' },
  { label: 'Wat telt', href: '#wat-telt' },
  { label: 'Contact', href: '#contact' },
];

export default function Nav({ brand, logoUrl, links }: NavProps) {
  const resolvedBrand = brand?.trim() || DEFAULT_BRAND;
  const resolvedLinks = links && links.length > 0 ? links : DEFAULT_LINKS;
  const trackedIds = ['top', ...resolvedLinks.map((l) => l.href.replace(/^#/, ''))];

  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('top');

  useEffect(() => {
    const onScroll = () => {
      let current = 'top';
      for (const id of trackedIds) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 100) {
          current = id;
        }
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedIds.join(',')]);

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-rule bg-bg/80 px-6 py-5 backdrop-blur-lg @min-[48rem]/site-frame:px-12 @min-[64rem]/site-frame:px-20"
    >
      <a href="#top" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
        {logoUrl ? (
          <>
            <img src={logoUrl} alt="" className="h-7 w-auto max-w-40 object-contain" />
            <span className="sr-only">{resolvedBrand}</span>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-accent" />
            <span className="font-sans text-[13px] font-medium uppercase tracking-[0.18em]">
              {resolvedBrand}
            </span>
          </>
        )}
      </a>

      {/* Desktop links */}
      <div className="hidden items-center gap-8 text-[13px] tracking-[0.04em] @min-[48rem]/site-frame:flex">
        {resolvedLinks.map((link) => {
          const id = link.href.replace(/^#/, '');
          const isActive = activeSection === id;
          return (
            <a
              key={id}
              href={link.href}
              className={`relative transition-colors ${
                isActive ? 'text-ink' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {link.label}
              {isActive && (
                <motion.span
                  layoutId="navIndicator"
                  aria-hidden="true"
                  className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full bg-accent"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </a>
          );
        })}
      </div>

      {/* Mobile toggle */}
      <button
        type="button"
        aria-label={isOpen ? 'Menu sluiten' : 'Menu openen'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className="rounded-full bg-accent/10 p-2 text-ink transition-colors hover:bg-accent/20 @min-[48rem]/site-frame:hidden"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile menu */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute right-4 left-4 top-full z-50 mt-2 flex w-[calc(100%-2rem)] flex-col gap-5 rounded-2xl border border-rule bg-card p-6 shadow-2xl @min-[48rem]/site-frame:hidden"
          >
            {resolvedLinks.map((link, i) => {
              const id = link.href.replace(/^#/, '');
              const isActive = activeSection === id;
              return (
                <motion.a
                  key={id}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ delay: i * 0.06, duration: 0.2 }}
                  className={`text-[15px] tracking-[0.04em] ${
                    isActive ? 'font-medium text-ink' : 'text-ink-muted'
                  }`}
                >
                  {link.label}
                </motion.a>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
