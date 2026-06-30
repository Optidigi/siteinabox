import { businessContentSchema } from "./schemas";
import { contentLimits } from "./constants";
import type {
  BusinessContentDetails,
  ContentCardId,
  OfferItem,
  WorkMode,
} from "./types";

export function compactText(value: string, maxLength = 92) {
  const text = value.trim().replace(/\s+/g, " ");

  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength - 1).trim()}…`;
}

export function countValidOffers(offers: OfferItem[]) {
  return offers.filter(
    (offer) => offer.value.trim().length >= contentLimits.offer.min,
  ).length;
}

function hasOverLimitText(value: string, max: number) {
  return value.length > max;
}

function hasOverLimitOffer(offers: OfferItem[]) {
  return offers.some((offer) =>
    hasOverLimitText(offer.value, contentLimits.offer.max),
  );
}

export function hasOnlyEveryone(value: string) {
  return ["iedereen", "allemaal", "iedereen."].includes(
    value.trim().toLowerCase(),
  );
}

export function hasGenericApproach(value: string) {
  const normalized = value.trim().toLowerCase();

  return (
    normalized === "kwaliteit en service" ||
    normalized === "goede kwaliteit" ||
    normalized === "service"
  );
}

export function needsWorkAreaRegion(workModes: WorkMode[]) {
  return (
    workModes.includes("on_location") || workModes.includes("fixed_region")
  );
}

export function isContentComplete(content: BusinessContentDetails) {
  return businessContentSchema.safeParse(content).success;
}

export function isContentCardComplete(
  cardId: ContentCardId,
  content: BusinessContentDetails,
) {
  if (cardId === "intro") {
    return (
      content.intro.trim().length >= contentLimits.intro.min &&
      !hasOverLimitText(content.intro, contentLimits.intro.max)
    );
  }

  if (cardId === "offer") {
    return (
      countValidOffers(content.offers) > 0 && !hasOverLimitOffer(content.offers)
    );
  }

  if (cardId === "customers") {
    return (
      content.audience.trim().length >= contentLimits.audience.min &&
      content.situation.trim().length >= contentLimits.situation.min &&
      !hasOverLimitText(content.audience, contentLimits.audience.max) &&
      !hasOverLimitText(content.situation, contentLimits.situation.max)
    );
  }

  if (cardId === "approach") {
    return (
      content.approach.trim().length >= contentLimits.approach.min &&
      !hasOverLimitText(content.approach, contentLimits.approach.max)
    );
  }

  if (cardId === "workArea") {
    const hasMode = content.workModes.length > 0;
    const needsRegion = needsWorkAreaRegion(content.workModes);

    return (
      hasMode &&
      (!needsRegion || content.region.trim().length >= contentLimits.region.min)
    );
  }

  return !hasOverLimitText(content.notes, contentLimits.notes.max);
}

export function getContentCardError(
  cardId: ContentCardId,
  content: BusinessContentDetails,
) {
  if (cardId === "intro") {
    if (hasOverLimitText(content.intro, contentLimits.intro.max))
      return "Maak je antwoord korter.";
    if (content.intro.trim().length < contentLimits.intro.min)
      return "Vertel kort wat iemand meteen moet begrijpen.";
  }

  if (cardId === "offer") {
    if (hasOverLimitOffer(content.offers))
      return "Houd ieder aanbod kort, bijvoorbeeld 2 tot 5 woorden.";
    if (countValidOffers(content.offers) < 1)
      return "Noem minimaal één dienst of onderwerp.";
  }

  if (cardId === "customers") {
    if (
      hasOverLimitText(content.audience, contentLimits.audience.max) ||
      hasOverLimitText(content.situation, contentLimits.situation.max)
    ) {
      return "Maak je antwoord korter.";
    }

    if (
      content.audience.trim().length < contentLimits.audience.min ||
      content.situation.trim().length < contentLimits.situation.min
    ) {
      return "Vertel voor wie je er bent en wanneer iemand contact opneemt.";
    }
  }

  if (cardId === "approach") {
    if (hasOverLimitText(content.approach, contentLimits.approach.max))
      return "Maak je antwoord korter.";
    if (content.approach.trim().length < contentLimits.approach.min)
      return "Vertel kort hoe je meestal werkt.";
  }

  if (cardId === "workArea") {
    if (content.workModes.length < 1) return "Kies minimaal één optie.";
    if (
      needsWorkAreaRegion(content.workModes) &&
      content.region.trim().length < contentLimits.region.min
    ) {
      return "Vul in waar je wilt werken.";
    }
  }

  if (
    cardId === "notes" &&
    hasOverLimitText(content.notes, contentLimits.notes.max)
  ) {
    return "Maak je antwoord korter.";
  }

  return "";
}

export function getContentCardLimitError(
  cardId: ContentCardId,
  content: BusinessContentDetails,
) {
  if (
    cardId === "intro" &&
    hasOverLimitText(content.intro, contentLimits.intro.max)
  )
    return "Maak je antwoord korter.";
  if (cardId === "offer" && hasOverLimitOffer(content.offers))
    return "Houd ieder aanbod kort, bijvoorbeeld 2 tot 5 woorden.";
  if (
    cardId === "customers" &&
    (hasOverLimitText(content.audience, contentLimits.audience.max) ||
      hasOverLimitText(content.situation, contentLimits.situation.max))
  ) {
    return "Maak je antwoord korter.";
  }
  if (
    cardId === "approach" &&
    hasOverLimitText(content.approach, contentLimits.approach.max)
  )
    return "Maak je antwoord korter.";
  if (
    cardId === "notes" &&
    hasOverLimitText(content.notes, contentLimits.notes.max)
  )
    return "Maak je antwoord korter.";

  return "";
}

export function getFirstIncompleteContentCard(
  content: BusinessContentDetails,
): ContentCardId | null {
  const requiredCards: ContentCardId[] = [
    "intro",
    "offer",
    "customers",
    "approach",
    "workArea",
  ];

  return (
    requiredCards.find((cardId) => !isContentCardComplete(cardId, content)) ??
    (isContentCardComplete("notes", content) ? null : "notes")
  );
}

export function getContentCardTitle(cardId: ContentCardId) {
  const titles: Record<ContentCardId, string> = {
    intro: "Korte uitleg",
    offer: "Aanbod",
    customers: "Klanten en situaties",
    approach: "Aanpak",
    workArea: "Werkgebied",
    notes: "Belangrijk om te weten",
  };

  return titles[cardId];
}
