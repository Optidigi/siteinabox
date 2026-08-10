import { useCallback, useEffect, useRef, useState } from "react";
import {
  createIntakeCardFocusScheduler,
  type IntakeCardFocusScheduler,
} from "./focus";
import {
  createIntakeSubmissionController,
  type IntakeSubmissionController,
  type IntakeSubmissionState,
} from "./submission";

export function useDebouncedValue<T>(value: T, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);

    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);

    setMatches(mediaQueryList.matches);

    function handleChange(event: MediaQueryListEvent) {
      setMatches(event.matches);
    }

    mediaQueryList.addEventListener("change", handleChange);

    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

export function useIntakeCardFocus() {
  const schedulerRef = useRef<IntakeCardFocusScheduler | null>(null);

  const focusIntakeCard = useCallback((panelId: string) => {
    if (!schedulerRef.current) {
      schedulerRef.current = createIntakeCardFocusScheduler(document, window);
    }

    schedulerRef.current.schedule(panelId);
  }, []);

  useEffect(() => {
    return () => schedulerRef.current?.cancel();
  }, []);

  return focusIntakeCard;
}

export function useIntakeSubmission<T>({
  submit,
  onSuccess,
}: {
  submit: (values: T) => Promise<unknown>;
  onSuccess: () => void;
}) {
  const [state, setState] = useState<IntakeSubmissionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<IntakeSubmissionController<T> | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = createIntakeSubmissionController({
      submit,
      onStateChange: setState,
      onError: setError,
      onSuccess,
    });
  }

  useEffect(() => {
    return () => controllerRef.current?.dispose();
  }, []);

  return {
    error,
    isSubmitting: state === "submitting",
    resetError: controllerRef.current.resetError,
    submit: controllerRef.current.submit,
  };
}
