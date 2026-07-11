import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import {
  CompanyConfirmationStep,
  CompanyLookupStep,
  ContactDetailsStep,
  ContactStep,
  ContentCanvasStep,
  FinalDetailsStep,
  ManualEntryStep,
  SuccessStep,
  VisualColorsStep,
  VisualLogoStep,
  VisualStyleStep,
} from "@/components/intake/steps";
import { Button } from "@/components/ui/button";
import { LoadingDots, SegmentedProgress } from "@/components/intake/progress";
import { submitIntake } from "@/components/intake/domain/submission";
import { intakeStepMeta } from "@/components/intake/flow";
import { cn } from "@/components/ui/utils";
import {
  defaultIntakeValues,
  getContentCardTitle,
  getFirstIncompleteContactSection,
  getFirstIncompleteContactDetailsSection,
  getFirstIncompleteContentCard,
  getFirstIncompleteFinalDetailsField,
  getVisualColorError,
  getVisualLogoError,
  getVisualStyleError,
  getRegionFromAddress,
  getRegionFromCompanyDetails,
  intakeFormSchema,
  isContactComplete,
  isContactDetailsComplete,
  isContentComplete,
  isFinalDetailsComplete,
  isVisualColorComplete,
  isVisualLogoComplete,
  isVisualStyleComplete,
  manualCompanyFormId,
  totalWizardSteps,
  type ContactDetailsSectionId,
  type ContentCardId,
  type ContactSectionId,
  type IntakeChoice,
  type IntakeFormValues,
  type IntakePhase,
  type KvkSearchResult,
  type ManualCompanyDetails,
} from "@/components/intake/model";

const intakeAssetBuildMarker = "prefix-route-20260630";

function IntakeShellContent() {
  const [selectedChoice, setSelectedChoice] = useState<IntakeChoice>(null);
  const [selectedCompany, setSelectedCompany] =
    useState<KvkSearchResult | null>(null);
  const [canContinueManual, setCanContinueManual] = useState(false);
  const [phase, setPhase] = useState<IntakePhase>("lookup");
  const [openContentCard, setOpenContentCard] = useState<ContentCardId | "">(
    "intro",
  );
  const [openContactSection, setOpenContactSection] = useState<
    ContactSectionId | ""
  >("");
  const [contentContinueAttempted, setContentContinueAttempted] =
    useState(false);
  const [contentValidationVisible, setContentValidationVisible] =
    useState(false);
  const [contactContinueAttempted, setContactContinueAttempted] =
    useState(false);
  const [contactDetailsContinueAttempted, setContactDetailsContinueAttempted] =
    useState(false);
  const [visualLogoContinueAttempted, setVisualLogoContinueAttempted] =
    useState(false);
  const [visualColorsContinueAttempted, setVisualColorsContinueAttempted] =
    useState(false);
  const [visualStyleContinueAttempted, setVisualStyleContinueAttempted] =
    useState(false);
  const [finalDetailsContinueAttempted, setFinalDetailsContinueAttempted] =
    useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "submitting">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [contactEntryVersion, setContactEntryVersion] = useState(0);
  const [contactAttemptVersion, setContactAttemptVersion] = useState(0);
  const mainShellRef = useRef<HTMLElement>(null);
  const taskScrollRef = useRef<HTMLDivElement>(null);
  const intakeForm = useForm<IntakeFormValues>({
    resolver: zodResolver(intakeFormSchema),
    mode: "onChange",
    defaultValues: defaultIntakeValues,
  });
  const companyValues = intakeForm.watch("company");
  const contentValues = intakeForm.watch("content");
  const contactValues = intakeForm.watch("contact");
  const visualValues = intakeForm.watch("visual");
  const finalDetailsValues = intakeForm.watch("finalDetails");
  const legalValues = intakeForm.watch("legal");
  const isLoading = submitState === "submitting";
  const isManualEntry = phase === "manual";
  const isConfirmingCompany = phase === "confirm" && selectedCompany;
  const isContentEntry = phase === "content";
  const isContactEntry = phase === "contact";
  const isContactDetailsEntry = phase === "contactDetails";
  const isVisualLogoEntry = phase === "visualLogo";
  const isVisualColorsEntry = phase === "visualColors";
  const isVisualStyleEntry = phase === "visualStyle";
  const isFinalDetailsEntry = phase === "finalDetails";
  const isSuccess = phase === "success";
  const stepMeta = intakeStepMeta[phase];
  const showProgress = stepMeta.progress !== null;
  const currentStep = stepMeta.progress ?? 1;
  const canContinueContent = isContentComplete(contentValues);
  const canContinueContact = isContactComplete(contactValues);
  const canContinueContactDetails = isContactDetailsComplete(contactValues);
  const canContinueVisualLogo = isVisualLogoComplete(visualValues);
  const canContinueVisualColors = isVisualColorComplete(visualValues);
  const canContinueVisualStyle = isVisualStyleComplete(visualValues);
  const canContinueFinalDetails =
    isFinalDetailsComplete(finalDetailsValues) &&
    legalValues.businessUseAccepted &&
    legalValues.termsAccepted;
  const showContentCompletionHint =
    isContentEntry && !canContinueContent && contentContinueAttempted;
  const firstIncompleteContactSection = isContactEntry
    ? getFirstIncompleteContactSection(contactValues)
    : null;
  const contactSectionTitles = {
    actions: "Wat moet een bezoeker vooral kunnen doen?",
  } as const;
  const firstIncompleteContactDetailsSection = isContactDetailsEntry
    ? getFirstIncompleteContactDetailsSection(contactValues)
    : null;
  const contactDetailsSectionTitles: Record<ContactDetailsSectionId, string> = {
    direct: "Telefoon en WhatsApp",
    location: "Locatie of werkgebied",
    availability: "Tijden en bereikbaarheid",
  };
  const showContactCompletionHint =
    isContactEntry &&
    !canContinueContact &&
    contactContinueAttempted &&
    contactAttemptVersion > contactEntryVersion;
  const showContactAttemptedErrors =
    isContactEntry &&
    contactContinueAttempted &&
    contactAttemptVersion > contactEntryVersion;
  const showContactDetailsCompletionHint =
    isContactDetailsEntry &&
    !canContinueContactDetails &&
    contactDetailsContinueAttempted;
  const showVisualLogoCompletionHint =
    isVisualLogoEntry && !canContinueVisualLogo && visualLogoContinueAttempted;
  const showVisualColorsCompletionHint =
    isVisualColorsEntry &&
    !canContinueVisualColors &&
    visualColorsContinueAttempted;
  const showVisualStyleCompletionHint =
    isVisualStyleEntry && !canContinueVisualStyle && visualStyleContinueAttempted;
  const showFinalDetailsCompletionHint =
    isFinalDetailsEntry &&
    ((!canContinueFinalDetails && finalDetailsContinueAttempted) ||
      Boolean(submitError));
  const contactDetailsCompletionHint = firstIncompleteContactDetailsSection
    ? `Vul eerst “${contactDetailsSectionTitles[firstIncompleteContactDetailsSection]}” in om verder te gaan.`
    : "";
  const contactDetailsCompletionHintId = "contact-details-completion-hint";
  const visualLogoCompletionHint =
    getVisualLogoError("mode", visualValues) ||
    getVisualLogoError("file", visualValues) ||
    getVisualLogoError("text", visualValues);
  const visualLogoCompletionHintId = "visual-logo-completion-hint";
  const visualColorsCompletionHint =
    getVisualColorError("source", visualValues) ||
    getVisualColorError("palette", visualValues);
  const visualColorsCompletionHintId = "visual-colors-completion-hint";
  const visualStyleCompletionHint =
    getVisualStyleError("shape", visualValues) ||
    getVisualStyleError("typography", visualValues);
  const visualStyleCompletionHintId = "visual-style-completion-hint";
  const firstIncompleteFinalDetailsField = isFinalDetailsEntry
    ? getFirstIncompleteFinalDetailsField(finalDetailsValues)
    : null;
  const finalDetailsFieldTitles = {
    name: "naam",
    email: "e-mailadres",
    phone: "telefoonnummer",
  } as const;
  const finalDetailsCompletionHint = firstIncompleteFinalDetailsField
    ? `Controleer je ${finalDetailsFieldTitles[firstIncompleteFinalDetailsField]}.`
    : !legalValues.businessUseAccepted
      ? "Bevestig dat je de aanvraag zakelijk doet."
      : !legalValues.termsAccepted
        ? "Accepteer de algemene voorwaarden om je aanvraag te versturen."
      : submitError ?? "";
  const finalDetailsCompletionHintId = "final-details-completion-hint";
  const firstIncompleteContentCard = isContentEntry
    ? getFirstIncompleteContentCard(contentValues)
    : null;
  const contentCompletionHint = firstIncompleteContentCard
    ? `Vul eerst “${getContentCardTitle(firstIncompleteContentCard)}” in om verder te gaan.`
    : "";
  const contentCompletionHintId = "content-completion-hint";
  const contactCompletionHint = firstIncompleteContactSection
    ? `Vul eerst “${contactSectionTitles[firstIncompleteContactSection]}” in om verder te gaan.`
    : "";
  const contactCompletionHintId = "contact-completion-hint";
  const canContinue = isManualEntry
    ? canContinueManual
    : isConfirmingCompany
      ? companyValues.source === "kvk" && Boolean(companyValues.companyName)
      : Boolean(selectedChoice);
  const actionRailClassName = cn(
    "flex w-full bg-background px-6 py-4 sm:px-8 lg:px-10 min-[1360px]:h-[104px] min-[1360px]:items-center min-[1360px]:justify-between min-[1360px]:px-[54px] min-[1360px]:py-6",
    (showContentCompletionHint ||
      showContactCompletionHint ||
      showContactDetailsCompletionHint ||
      showVisualLogoCompletionHint ||
      showVisualColorsCompletionHint ||
      showVisualStyleCompletionHint ||
      showFinalDetailsCompletionHint) &&
      "flex-col gap-3 min-[1360px]:flex-row min-[1360px]:gap-6",
  );
  function handleBackToLookup() {
    setPhase("lookup");
  }

  useEffect(() => {
    if (phase === "contact") {
      setContactContinueAttempted(false);
      setContactDetailsContinueAttempted(false);
      setOpenContactSection("");
      setContactAttemptVersion(0);
      intakeForm.clearErrors("contact");
    }

    if (phase === "contactDetails") {
      setContactDetailsContinueAttempted(false);
      intakeForm.clearErrors("contact");
    }

    if (phase === "visualLogo") {
      setVisualLogoContinueAttempted(false);
      intakeForm.clearErrors("visual");
    }

    if (phase === "visualColors") {
      setVisualColorsContinueAttempted(false);
      intakeForm.clearErrors("visual");
    }

    if (phase === "visualStyle") {
      setVisualStyleContinueAttempted(false);
      intakeForm.clearErrors("visual");
    }

    if (phase === "finalDetails") {
      setFinalDetailsContinueAttempted(false);
      intakeForm.clearErrors("finalDetails");
      intakeForm.clearErrors("legal");
      setSubmitError(null);
    }
  }, [intakeForm, phase]);

  useEffect(() => {
    mainShellRef.current?.scrollTo({ left: 0, top: 0 });
    taskScrollRef.current?.scrollTo({ left: 0, top: 0 });
    window.scrollTo({ left: 0, top: 0 });
  }, [phase]);

  useEffect(() => {
    const shell = mainShellRef.current;
    if (!shell) return;

    function resetDesktopShellScroll() {
      if (!shell) return;
      if (!window.matchMedia("(min-width: 1360px)").matches) return;
      if (shell.scrollTop === 0) return;

      window.requestAnimationFrame(() => {
        shell.scrollTop = 0;
      });
    }

    shell.addEventListener("scroll", resetDesktopShellScroll);

    return () => {
      shell.removeEventListener("scroll", resetDesktopShellScroll);
    };
  }, []);

  function handleBackFromContent() {
    setContentValidationVisible(false);
    setPhase(companyValues.source === "manual" ? "manual" : "confirm");
  }

  function handleBackFromContact() {
    setPhase("content");
  }

  function handleBackFromContactDetails() {
    setContactDetailsContinueAttempted(false);
    setPhase("contact");
  }

  function handleBackFromVisualLogo() {
    setVisualLogoContinueAttempted(false);
    setPhase("contactDetails");
  }

  function handleBackFromVisualColors() {
    setVisualColorsContinueAttempted(false);
    setPhase("visualLogo");
  }

  function handleBackFromVisualStyle() {
    setVisualStyleContinueAttempted(false);
    setPhase("visualColors");
  }

  function handleBackFromFinalDetails() {
    setFinalDetailsContinueAttempted(false);
    setPhase("visualStyle");
  }

  function prefillContentRegion() {
    const region = getRegionFromCompanyDetails(intakeForm.getValues("company"));

    if (region && !intakeForm.getValues("content.region").trim()) {
      intakeForm.setValue("content.region", region, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      });
    }
  }

  function prefillContactLocation() {
    const contentRegion = intakeForm.getValues("content.region").trim();
    const region =
      getRegionFromAddress(contentRegion) ||
      getRegionFromCompanyDetails(intakeForm.getValues("company"));
    const address = intakeForm.getValues("company.address").trim();

    if (region && !intakeForm.getValues("contact.publicRegion").trim()) {
      intakeForm.setValue("contact.publicRegion", region, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      });
    }

    if (address && !intakeForm.getValues("contact.publicAddress").trim()) {
      intakeForm.setValue("contact.publicAddress", address, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      });
    }
  }

  function focusIntakeCard(panelId: string) {
    const focusFirstRelevantControl = () => {
      const panel = document.querySelector(
        `[data-intake-card-panel="${panelId}"]`,
      );
      const focusSelectors = [
        "input[aria-invalid='true']:not([disabled])",
        "textarea[aria-invalid='true']:not([disabled])",
        "[role='radiogroup'][aria-invalid='true'] [role='radio']:not([disabled])",
        "textarea:not([disabled])",
        "input:not([disabled])",
        "button:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ];
      const focusTarget = focusSelectors
        .map((selector) => panel?.querySelector<HTMLElement>(selector))
        .find(Boolean);

      focusTarget?.focus({ preventScroll: true });
      focusTarget?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    window.setTimeout(focusFirstRelevantControl, 120);
    window.setTimeout(focusFirstRelevantControl, 320);
    window.setTimeout(focusFirstRelevantControl, 700);
  }

  async function handleFinalSubmit() {
    setFinalDetailsContinueAttempted(false);
    setSubmitError(null);
    setSubmitState("submitting");

    try {
      await submitIntake(intakeForm.getValues());
      setPhase("success");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Je aanvraag kon niet worden verstuurd.",
      );
    } finally {
      setSubmitState("idle");
    }
  }

  function handleContinue() {
    if (isFinalDetailsEntry) {
      if (!canContinueFinalDetails) {
        setFinalDetailsContinueAttempted(true);
        void intakeForm
          .trigger(["finalDetails", "legal"])
          .then(() => focusIntakeCard("final-details"));
        return;
      }

      setFinalDetailsContinueAttempted(false);
      void intakeForm.trigger(["finalDetails", "legal"]);
      void handleFinalSubmit();
      return;
    }

    if (isVisualStyleEntry) {
      if (!canContinueVisualStyle) {
        setVisualStyleContinueAttempted(true);
        void intakeForm.trigger("visual");
        focusIntakeCard(
          getVisualStyleError("shape", visualValues)
            ? "visual-style-shape"
            : "visual-style-typography",
        );
        return;
      }

      setVisualStyleContinueAttempted(false);
      void intakeForm.trigger("visual");
      setFinalDetailsContinueAttempted(false);
      setPhase("finalDetails");
      return;
    }

    if (isVisualColorsEntry) {
      if (!canContinueVisualColors) {
        setVisualColorsContinueAttempted(true);
        void intakeForm.trigger("visual");
        focusIntakeCard(
          getVisualColorError("source", visualValues)
            ? "visual-colors-source"
            : "visual-colors-palette",
        );
        return;
      }

      setVisualColorsContinueAttempted(false);
      void intakeForm.trigger("visual");
      setPhase("visualStyle");
      return;
    }

    if (isVisualLogoEntry) {
      if (!canContinueVisualLogo) {
        setVisualLogoContinueAttempted(true);
        void intakeForm.trigger("visual");
        focusIntakeCard("visual-logo");
        return;
      }

      setVisualLogoContinueAttempted(false);
      void intakeForm.trigger("visual");
      setPhase("visualColors");
      return;
    }

    if (isContactDetailsEntry) {
      if (!canContinueContactDetails) {
        const firstIncompleteSection =
          getFirstIncompleteContactDetailsSection(contactValues);

        setContactDetailsContinueAttempted(true);

        if (firstIncompleteSection) {
          focusIntakeCard(`contact-details-${firstIncompleteSection}`);
        }

        return;
      }

      setContactDetailsContinueAttempted(false);
      setVisualLogoContinueAttempted(false);
      setPhase("visualLogo");
      return;
    }

    if (isContactEntry) {
      if (!canContinueContact) {
        const firstIncompleteSection =
          getFirstIncompleteContactSection(contactValues);

        setContactContinueAttempted(true);
        setContactAttemptVersion(Date.now());

        if (firstIncompleteSection) {
          setOpenContactSection(firstIncompleteSection);
          void intakeForm
            .trigger("contact")
            .then(() => focusIntakeCard(`contact-${firstIncompleteSection}`));
        } else {
          void intakeForm.trigger("contact");
        }

        return;
      }

      setContactContinueAttempted(false);
      void intakeForm.trigger("contact");
      setContactDetailsContinueAttempted(false);
      setPhase("contactDetails");
      return;
    }

    if (isContentEntry) {
      if (!canContinueContent) {
        const firstIncompleteCard =
          getFirstIncompleteContentCard(contentValues);

        setContentContinueAttempted(true);
        void intakeForm.trigger("content");

        if (firstIncompleteCard) {
          setContentValidationVisible(openContentCard === firstIncompleteCard);
          setOpenContentCard(firstIncompleteCard);
          focusIntakeCard(`content-${firstIncompleteCard}`);
        }

        return;
      }

      setContentContinueAttempted(false);
      setContentValidationVisible(false);
      void intakeForm.trigger("content");
      prefillContactLocation();
      setContactContinueAttempted(false);
      setContactEntryVersion(Date.now());
      setContactAttemptVersion(0);
      setOpenContactSection("");
      setPhase("contact");
      return;
    }

    if (isConfirmingCompany) {
      prefillContentRegion();
      setOpenContentCard("intro");
      setContentContinueAttempted(false);
      setContentValidationVisible(false);
      setPhase("content");
      return;
    }

    if (selectedChoice === "company" && selectedCompany) {
      setPhase("confirm");
      return;
    }

    if (selectedChoice === "manual") {
      setPhase("manual");
    }
  }

  function handleManualSubmit(values: ManualCompanyDetails) {
    intakeForm.setValue(
      "company",
      {
        ...intakeForm.getValues("company"),
        source: "manual",
        companyName: values.companyName,
        kvkNumber: values.kvkNumber,
        address: values.address,
        website: "",
        mainActivity: "",
        secondaryActivities: [],
      },
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );

    const region = getRegionFromCompanyDetails(intakeForm.getValues("company"));
    if (region && !intakeForm.getValues("content.region").trim()) {
      intakeForm.setValue("content.region", region, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      });
    }

    setPhase("content");
    setOpenContentCard("intro");
    setContentContinueAttempted(false);
  }

  return (
    <FormProvider {...intakeForm}>
      <main
        ref={mainShellRef}
        aria-label="Site in a Box intake"
        className="min-h-dvh overflow-x-hidden bg-background text-foreground min-[1360px]:flex min-[1360px]:h-dvh min-[1360px]:overflow-hidden min-[1360px]:overscroll-none min-[1360px]:bg-intake-panel"
      >
        <aside className="relative z-0 flex min-h-[220px] flex-col bg-background px-6 py-4 sm:px-8 lg:px-10 min-[1360px]:sticky min-[1360px]:top-0 min-[1360px]:min-h-dvh min-[1360px]:w-[34%] min-[1360px]:shrink-0 min-[1360px]:bg-intake-panel min-[1360px]:px-14 min-[1360px]:py-14">
          <a
            href="/"
            aria-label="Site in a Box intake start"
            className="mx-auto block w-fit min-[1360px]:mx-0"
          >
            <img
              src="/intake/brand/siab-logo.svg"
              alt="Site in a Box"
              className="h-auto w-[84px] min-[1360px]:w-[156px]"
            />
          </a>

          <div className="mx-auto mt-8 w-full max-w-[780px] min-[1360px]:mx-0 min-[1360px]:mt-24 min-[1360px]:max-w-[24rem]">
            {showProgress ? (
              <p className="text-base font-thin leading-6 text-intake-text">
                {currentStep} van {totalWizardSteps}
              </p>
            ) : null}
            <h1 className="mt-2 text-[1.75rem] font-normal leading-[1.1] tracking-normal text-balance md:mt-2 md:text-[clamp(2.05rem,3.15vw,2.45rem)]">
              {stepMeta.heading}
            </h1>
            <p className="mt-4 max-w-[560px] text-base font-normal leading-6 text-intake-muted-text md:mt-6 min-[1360px]:max-w-[360px]">
              {stepMeta.subtitle}
            </p>
          </div>
        </aside>

        <section className="relative z-10 flex min-h-[calc(100dvh-260px)] flex-1 flex-col bg-background px-6 pt-2 pb-0 sm:px-8 lg:px-10 min-[1360px]:h-dvh min-[1360px]:min-h-0 min-[1360px]:rounded-tl-[60px] min-[1360px]:!px-0 min-[1360px]:py-0 min-[1360px]:shadow-[26px_4px_47px_0_rgba(183,183,182,0.72)]">
          <div
            ref={taskScrollRef}
            className="flex w-full flex-1 items-start justify-center py-8 md:py-10 lg:py-6 min-[1360px]:min-h-0 min-[1360px]:overflow-y-auto min-[1360px]:px-16 min-[1360px]:[scrollbar-gutter:stable] [@media(min-width:1360px)]:pt-28 [@media(min-width:1536px)]:pt-36 [@media(min-width:1360px)]:pb-10"
          >
            {isConfirmingCompany ? (
              <CompanyConfirmationStep
                company={selectedCompany}
                onBack={handleBackToLookup}
              />
            ) : isContentEntry ? (
              <ContentCanvasStep
                form={intakeForm}
                openCard={openContentCard}
                showAttemptedErrors={contentValidationVisible}
                onOpenCardChange={(cardId) => {
                  setContentValidationVisible(false);
                  setOpenContentCard(cardId);
                }}
                onBack={handleBackFromContent}
              />
            ) : isContactEntry ? (
              <ContactStep
                form={intakeForm}
                openCard={openContactSection}
                showAttemptedErrors={showContactAttemptedErrors}
                onOpenCardChange={setOpenContactSection}
                onBack={handleBackFromContact}
              />
            ) : isContactDetailsEntry ? (
              <ContactDetailsStep
                form={intakeForm}
                showAttemptedErrors={contactDetailsContinueAttempted}
                onBack={handleBackFromContactDetails}
              />
            ) : isVisualLogoEntry ? (
              <VisualLogoStep
                form={intakeForm}
                showAttemptedErrors={visualLogoContinueAttempted}
                onBack={handleBackFromVisualLogo}
              />
            ) : isVisualColorsEntry ? (
              <VisualColorsStep
                form={intakeForm}
                showAttemptedErrors={visualColorsContinueAttempted}
                onBack={handleBackFromVisualColors}
              />
            ) : isVisualStyleEntry ? (
              <VisualStyleStep
                form={intakeForm}
                showAttemptedErrors={visualStyleContinueAttempted}
                onBack={handleBackFromVisualStyle}
              />
            ) : isFinalDetailsEntry ? (
              <FinalDetailsStep
                form={intakeForm}
                showAttemptedErrors={finalDetailsContinueAttempted}
                onBack={handleBackFromFinalDetails}
              />
            ) : isSuccess ? (
              <SuccessStep />
            ) : isManualEntry ? (
              <ManualEntryStep
                onCanContinueChange={setCanContinueManual}
                onBack={handleBackToLookup}
                onSubmit={handleManualSubmit}
              />
            ) : (
              <CompanyLookupStep
                selectedChoice={selectedChoice}
                selectedCompany={selectedCompany}
                onChoiceChange={setSelectedChoice}
                onCompanyChange={setSelectedCompany}
              />
            )}
          </div>

          {!isSuccess ? (
            <footer className="mt-auto -mx-6 bg-background sm:-mx-8 lg:-mx-10 min-[1360px]:z-20 min-[1360px]:!mx-0 min-[1360px]:shrink-0">
            {showProgress ? (
              <SegmentedProgress
                current={currentStep}
                total={totalWizardSteps}
              />
            ) : null}
            <div className={actionRailClassName}>
              {showProgress ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={
                    isFinalDetailsEntry
                      ? handleBackFromFinalDetails
                      : isVisualStyleEntry
                      ? handleBackFromVisualStyle
                      : isVisualColorsEntry
                        ? handleBackFromVisualColors
                        : isVisualLogoEntry
                          ? handleBackFromVisualLogo
                          : isContactDetailsEntry
                      ? handleBackFromContactDetails
                      : isContactEntry
                        ? handleBackFromContact
                        : isContentEntry
                          ? handleBackFromContent
                          : handleBackToLookup
                  }
                  aria-label="Terug"
                  className="hidden size-14 rounded-[8px] border-intake-border-strong bg-background text-intake-text shadow-none hover:bg-intake-panel min-[1360px]:inline-flex"
                >
                  <ChevronLeft
                    className="size-5"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </Button>
              ) : (
                <span
                  className="hidden min-[1360px]:block"
                  aria-hidden="true"
                />
              )}
              {showContentCompletionHint ? (
                <p
                  id={contentCompletionHintId}
                  className="max-w-[560px] text-sm font-normal leading-5 text-intake-muted-text min-[1360px]:mx-auto min-[1360px]:text-center"
                >
                  {contentCompletionHint}
                </p>
              ) : null}
              {showContactCompletionHint ? (
                <p
                  id={contactCompletionHintId}
                  className="max-w-[560px] text-sm font-normal leading-5 text-intake-muted-text min-[1360px]:mx-auto min-[1360px]:text-center"
                >
                  {contactCompletionHint}
                </p>
              ) : null}
              {showContactDetailsCompletionHint ? (
                <p
                  id={contactDetailsCompletionHintId}
                  className="max-w-[560px] text-sm font-normal leading-5 text-intake-muted-text min-[1360px]:mx-auto min-[1360px]:text-center"
                >
                  {contactDetailsCompletionHint}
                </p>
              ) : null}
              {showVisualLogoCompletionHint ? (
                <p
                  id={visualLogoCompletionHintId}
                  className="max-w-[560px] text-sm font-normal leading-5 text-intake-muted-text min-[1360px]:mx-auto min-[1360px]:text-center"
                >
                  {visualLogoCompletionHint}
                </p>
              ) : null}
              {showVisualColorsCompletionHint ? (
                <p
                  id={visualColorsCompletionHintId}
                  className="max-w-[560px] text-sm font-normal leading-5 text-intake-muted-text min-[1360px]:mx-auto min-[1360px]:text-center"
                >
                  {visualColorsCompletionHint}
                </p>
              ) : null}
              {showVisualStyleCompletionHint ? (
                <p
                  id={visualStyleCompletionHintId}
                  className="max-w-[560px] text-sm font-normal leading-5 text-intake-muted-text min-[1360px]:mx-auto min-[1360px]:text-center"
                >
                  {visualStyleCompletionHint}
                </p>
              ) : null}
              {showFinalDetailsCompletionHint ? (
                <p
                  id={finalDetailsCompletionHintId}
                  className="max-w-[560px] text-sm font-normal leading-5 text-intake-muted-text min-[1360px]:mx-auto min-[1360px]:text-center"
                >
                  {finalDetailsCompletionHint}
                </p>
              ) : null}
              <Button
                type={isManualEntry ? "submit" : "button"}
                form={isManualEntry ? manualCompanyFormId : undefined}
                onClick={isManualEntry ? undefined : handleContinue}
                className={cn(
                  "h-14 w-full rounded-full bg-intake-primary px-6 text-center text-base font-normal leading-5 text-intake-primary-foreground hover:bg-intake-primary/95 disabled:opacity-100",
                  isFinalDetailsEntry
                    ? "min-[1360px]:w-auto min-[1360px]:min-w-[190px] min-[1360px]:px-8"
                    : "min-[1360px]:w-[150px]",
                )}
                disabled={
                  isContentEntry ||
                  isContactEntry ||
                  isContactDetailsEntry ||
                  isVisualLogoEntry ||
                  isVisualColorsEntry ||
                  isVisualStyleEntry ||
                  isFinalDetailsEntry
                    ? isLoading
                    : !canContinue || isLoading
                }
                aria-busy={isLoading}
                aria-describedby={
                  showContentCompletionHint
                    ? contentCompletionHintId
                    : showContactCompletionHint
                      ? contactCompletionHintId
                      : showContactDetailsCompletionHint
                        ? contactDetailsCompletionHintId
                        : showVisualLogoCompletionHint
                          ? visualLogoCompletionHintId
                          : showVisualColorsCompletionHint
                            ? visualColorsCompletionHintId
                            : showVisualStyleCompletionHint
                              ? visualStyleCompletionHintId
                              : showFinalDetailsCompletionHint
                                ? finalDetailsCompletionHintId
                        : undefined
                }
              >
                {isLoading ? (
                  <>
                    <span className="sr-only">Laden</span>
                    <LoadingDots />
                  </>
                ) : (
                  isFinalDetailsEntry ? "Aanvraag afronden" : "Verder"
                )}
              </Button>
            </div>
          </footer>
          ) : null}
        </section>
      </main>
    </FormProvider>
  );
}

export function IntakeShell() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <>
        <span hidden data-intake-build={intakeAssetBuildMarker} />
        <IntakeShellContent />
      </>
    </QueryClientProvider>
  );
}
