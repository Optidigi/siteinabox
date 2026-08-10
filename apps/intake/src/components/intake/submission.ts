export type IntakeSubmissionState = "idle" | "submitting";

type IntakeSubmissionControllerOptions<T> = {
  submit: (values: T) => Promise<unknown>;
  onStateChange: (state: IntakeSubmissionState) => void;
  onError: (message: string | null) => void;
  onSuccess: () => void;
};

export type IntakeSubmissionController<T> = {
  submit(values: T): Promise<void>;
  resetError(): void;
  dispose(): void;
};

export function createIntakeSubmissionController<T>({
  submit: submitValues,
  onStateChange,
  onError,
  onSuccess,
}: IntakeSubmissionControllerOptions<T>): IntakeSubmissionController<T> {
  let disposed = false;
  let inFlight = false;

  async function submit(values: T) {
    if (disposed || inFlight) return;

    inFlight = true;
    onError(null);
    onStateChange("submitting");

    try {
      await submitValues(values);
      if (!disposed) onSuccess();
    } catch (error) {
      if (!disposed) {
        onError(
          error instanceof Error
            ? error.message
            : "Je aanvraag kon niet worden verstuurd.",
        );
      }
    } finally {
      inFlight = false;
      if (!disposed) onStateChange("idle");
    }
  }

  function resetError() {
    if (!disposed) onError(null);
  }

  function dispose() {
    disposed = true;
  }

  return { submit, resetError, dispose };
}
