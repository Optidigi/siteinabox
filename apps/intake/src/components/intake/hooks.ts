import { useCallback, useEffect, useRef, useState } from "react";
import {
  createIntakeCardFocusScheduler,
  type IntakeCardFocusScheduler,
} from "./focus";

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
