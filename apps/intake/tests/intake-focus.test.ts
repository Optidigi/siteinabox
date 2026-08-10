import { describe, expect, it } from 'vitest';
import {
  createIntakeCardFocusScheduler,
  intakeCardFocusDelays,
} from '../src/components/intake/focus';

type FakeTimer = {
  callback: () => void;
  delay: number;
  cancelled: boolean;
};

function createFocusHarness() {
  const timers = new Map<number, FakeTimer>();
  const clearedTimerIds: number[] = [];
  const focusCalls: Array<{ preventScroll: boolean }> = [];
  const scrollCalls: Array<{ block: string; inline: string }> = [];
  let nextTimerId = 1;

  const target = {
    focus(options: { preventScroll: boolean }) {
      focusCalls.push(options);
    },
    scrollIntoView(options: { block: string; inline: string }) {
      scrollCalls.push(options);
    },
  };
  const panel = {
    querySelector: () => target,
  };
  const documentRef = {
    querySelector: () => panel,
  } as unknown as Document;
  const windowRef = {
    setTimeout(callback: () => void, delay: number) {
      const timerId = nextTimerId++;
      timers.set(timerId, { callback, delay, cancelled: false });
      return timerId;
    },
    clearTimeout(timerId: number) {
      clearedTimerIds.push(timerId);
      const timer = timers.get(timerId);
      if (timer) timer.cancelled = true;
    },
  } as unknown as Pick<Window, 'clearTimeout' | 'setTimeout'>;

  return {
    clearedTimerIds,
    focusCalls,
    scrollCalls,
    timers,
    scheduler: createIntakeCardFocusScheduler(documentRef, windowRef),
  };
}

describe('intake card focus scheduling', () => {
  it('preserves the staged focus timings and target behavior', () => {
    const harness = createFocusHarness();

    harness.scheduler.schedule('content-offer');

    expect([...harness.timers.values()].map((timer) => timer.delay)).toEqual(
      intakeCardFocusDelays,
    );

    for (const timer of harness.timers.values()) {
      timer.callback();
    }

    expect(harness.focusCalls).toHaveLength(3);
    expect(harness.focusCalls[0]).toEqual({ preventScroll: true });
    expect(harness.scrollCalls).toHaveLength(3);
    expect(harness.scrollCalls[0]).toEqual({
      block: 'nearest',
      inline: 'nearest',
    });
  });

  it('cancels earlier timers when navigation schedules a new panel', () => {
    const harness = createFocusHarness();

    harness.scheduler.schedule('content-offer');
    const firstTimerIds = [...harness.timers.keys()];
    harness.scheduler.schedule('content-audience');

    expect(harness.clearedTimerIds).toEqual(firstTimerIds);

    for (const [timerId, timer] of harness.timers) {
      if (!timer.cancelled) timer.callback();
      else expect(harness.clearedTimerIds).toContain(timerId);
    }

    expect(harness.focusCalls).toHaveLength(3);
    expect(harness.scrollCalls).toHaveLength(3);
  });

  it('cancels all pending timers on cleanup', () => {
    const harness = createFocusHarness();

    harness.scheduler.schedule('content-offer');
    harness.scheduler.cancel();

    expect(harness.clearedTimerIds).toEqual([...harness.timers.keys()]);
    expect([...harness.timers.values()].every((timer) => timer.cancelled)).toBe(true);
  });
});
