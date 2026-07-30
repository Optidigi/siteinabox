import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { captureLandingEvent } from '@/lib/landing-analytics';
import { useState } from 'react';

const items = [
  {
    question: 'Hoe weten jullie wat er op mijn website moet komen?',
    answer: [
      'Via een korte vragenlijst van ongeveer 15 minuten. Je vertelt ons wat voor bedrijf je hebt, wie je klanten zijn, en welke stijl je aanspreekt. Je levert wat foto’s aan en eventueel je logo. Wij maken op basis daarvan de eerste versie van je website, inclusief teksten. In de feedbackronde stuur jij alles helemaal naar jouw smaak bij.',
    ],
  },
  {
    question: 'Wat kost Site in a Box, en wat zit erbij?',
    answer: [
      'Bij jaarbetaling betaal je €190 per jaar vooraf (ongeveer €16 per maand). Zo bespaar je €38 per jaar. Liever maandelijks? Dan is het €19 per maand, opzegbaar.',
      'Erbij: professionele website, klaar voor Google én ChatGPT, snelle laadtijd, veilig online, .nl-domein eerste jaar gratis (of je huidige domein), zelf teksten en foto’s aanpassen, NL-support. Optioneel: zakelijke e-mail. Alle prijzen excl. btw.',
    ],
  },
  {
    question: 'Wat betekent "alleen betalen als je tevreden bent" precies?',
    answer: [
      'Wij bouwen je website eerst. Je krijgt ’m te zien op een testadres (bijvoorbeeld jouwbedrijf.siteinabox.nl). Pas wanneer jij actief akkoord geeft, een klik op de bevestigingslink of een mailtje van jouw kant, sturen we de factuur en gaan we live. Geef je geen akkoord, dan betaal je niets. Jij bepaalt of het goed is, niet wij.',
    ],
  },
  {
    question: 'Wat als de eerste versie niet helemaal goed is?',
    answer: [
      'Geen probleem. Geef je belangrijkste feedback in één keer door. Wij verwerken de aanpassingen die binnen het pakket passen. Komen we er niet uit, dan stop je zonder factuur.',
    ],
  },
  {
    question: 'Past mijn bedrijf op één pagina?',
    answer: [
      'Voor de meeste net-gestarte bedrijven: ja. Een one-pager werkt goed als je een dienst aanbiedt waar potentiële klanten vooral willen weten wie je bent, wat je doet, voor wie, en hoe ze je kunnen bereiken. Denk aan ZZP-dienstverleners, lokale bedrijven, coaches, vakmensen en freelancers.',
      'Heb je iets uitgebreiders nodig, zoals een webshop, online cursus met betalingen, of een site met veel verschillende dienstpakketten? Dan kijken we graag wat mogelijk is en maken we zo nodig een apart voorstel. Stuur ons een berichtje met wat je voor ogen hebt, dan kijken we wat past en wat een passende prijs zou zijn.',
    ],
  },
  {
    question: 'Hoe kan ik opzeggen?',
    answer: [
      'Bij maandelijkse facturatie kun je vanaf dag één per maand opzeggen, met één maand opzegtermijn.',
      'Bij jaarbetaling betaal je €190 per jaar vooruit. Het abonnement wordt jaarlijks verlengd. Je kunt jaarlijks opzeggen, met één maand opzegtermijn vóór het einde van de lopende periode.',
    ],
  },
  {
    question: 'Wie is eigenaar van mijn domein en website?',
    answer: [
      'Je domein en content zijn van jou. Stop je later met Site in a Box, dan kun je je domein en eigen content meenemen.',
      'De website zelf bouwen en hosten wij in ons eigen systeem, dat is hoe we de prijs zo scherp kunnen houden. Wil je later overstappen naar een andere partij? Geen probleem: je neemt je domein en content mee, en die partij bouwt op die fundering een nieuwe site.',
    ],
  },
  {
    question: 'Kan ik zelf dingen aanpassen na lancering?',
    answer: [
      'Het meeste pas je zelf aan in de beheeromgeving: openingstijden, prijzen, foto’s, teksten en diensten. Geen technische kennis nodig, gewoon klikken en typen, zo vaak als je wilt.',
      'Hulp nodig of wil je iets groters aanpassen? Stuur ons een bericht, dan kijken we wat mogelijk is en wat het kost.',
    ],
  },
];

export function Faq() {
  const [openItems, setOpenItems] = useState<string[]>([]);
  const handleValueChange = (nextItems: string[]) => {
    const newlyOpened = nextItems.find((item) => !openItems.includes(item));
    setOpenItems(nextItems);
    if (!newlyOpened) return;
    const itemIndex = Number(newlyOpened.replace('faq-', ''));
    captureLandingEvent('site_journey_step', {
      journey_name: 'faq',
      journey_step: 'open_question',
      item_id: newlyOpened,
      item_index: Number.isFinite(itemIndex) ? itemIndex : 0,
      interaction_type: 'open',
    });
  };

  return (
    <Accordion className="w-full" value={openItems} onValueChange={handleValueChange}>
      {items.map((item, index) => (
        <AccordionItem key={item.question} value={`faq-${index}`}>
          <AccordionTrigger className="group/accordion-trigger min-h-16 px-5 py-4 text-[17px] font-extrabold sm:text-[19px] md:px-6">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5 pt-3 text-base leading-[1.65] md:px-6">
            {item.answer.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
