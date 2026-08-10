export const intakeCardFocusDelays = [120, 320, 700] as const;

type FocusDocument = Pick<Document, "querySelector">;
type FocusWindow = Pick<Window, "clearTimeout" | "setTimeout">;

const focusSelectors = [
  "input[aria-invalid='true']:not([disabled])",
  "textarea[aria-invalid='true']:not([disabled])",
  "[role='radiogroup'][aria-invalid='true'] [role='radio']:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
];

export type IntakeCardFocusScheduler = {
  schedule(panelId: string): void;
  cancel(): void;
};

export function createIntakeCardFocusScheduler(
  documentRef: FocusDocument,
  windowRef: FocusWindow,
): IntakeCardFocusScheduler {
  let timerIds: number[] = [];

  function cancel() {
    for (const timerId of timerIds) {
      windowRef.clearTimeout(timerId);
    }

    timerIds = [];
  }

  function schedule(panelId: string) {
    cancel();

    const focusFirstRelevantControl = () => {
      const panel = documentRef.querySelector<HTMLElement>(
        `[data-intake-card-panel="${panelId}"]`,
      );
      const focusTarget = focusSelectors
        .map((selector) => panel?.querySelector<HTMLElement>(selector))
        .find((target): target is HTMLElement => Boolean(target));

      focusTarget?.focus({ preventScroll: true });
      focusTarget?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    timerIds = intakeCardFocusDelays.map((delay) =>
      windowRef.setTimeout(focusFirstRelevantControl, delay),
    );
  }

  return { schedule, cancel };
}
