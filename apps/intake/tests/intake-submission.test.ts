import { describe, expect, it } from 'vitest';
import { createIntakeSubmissionController } from '../src/components/intake/submission';

function createControllerHarness(submit: (value: string) => Promise<unknown>) {
  const states: string[] = [];
  const errors: Array<string | null> = [];
  let successCount = 0;
  const controller = createIntakeSubmissionController({
    submit,
    onStateChange: (state) => states.push(state),
    onError: (message) => errors.push(message),
    onSuccess: () => {
      successCount += 1;
    },
  });

  return {
    controller,
    errors,
    getSuccessCount: () => successCount,
    states,
  };
}

describe('intake submission lifecycle', () => {
  it('clears errors, reports progress, and completes on success', async () => {
    const submitted: string[] = [];
    const harness = createControllerHarness(async (value) => {
      submitted.push(value);
    });

    await harness.controller.submit('wizard-values');

    expect(submitted).toEqual(['wizard-values']);
    expect(harness.errors).toEqual([null]);
    expect(harness.states).toEqual(['submitting', 'idle']);
    expect(harness.getSuccessCount()).toBe(1);
  });

  it('ignores a duplicate submit while the first request is in flight', async () => {
    let resolvePending!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolvePending = resolve;
    });
    let submitCount = 0;
    const harness = createControllerHarness(async () => {
      submitCount += 1;
      await pending;
    });

    const first = harness.controller.submit('wizard-values');
    const duplicate = harness.controller.submit('wizard-values');
    resolvePending();
    await Promise.all([first, duplicate]);

    expect(submitCount).toBe(1);
    expect(harness.getSuccessCount()).toBe(1);
    expect(harness.states).toEqual(['submitting', 'idle']);
  });

  it('reports server and unknown failures without leaving the busy state', async () => {
    const serverFailure = createControllerHarness(async () => {
      throw new Error('Server unavailable');
    });
    await serverFailure.controller.submit('wizard-values');

    expect(serverFailure.errors).toEqual([null, 'Server unavailable']);
    expect(serverFailure.states).toEqual(['submitting', 'idle']);
    expect(serverFailure.getSuccessCount()).toBe(0);

    const unknownFailure = createControllerHarness(async () => {
      throw 'unknown failure';
    });
    await unknownFailure.controller.submit('wizard-values');

    expect(unknownFailure.errors).toEqual([
      null,
      'Je aanvraag kon niet worden verstuurd.',
    ]);
  });

  it('suppresses completion and state updates after disposal', async () => {
    let resolvePending!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolvePending = resolve;
    });
    const harness = createControllerHarness(async () => pending);

    const submission = harness.controller.submit('wizard-values');
    harness.controller.dispose();
    resolvePending();
    await submission;

    expect(harness.getSuccessCount()).toBe(0);
    expect(harness.states).toEqual(['submitting']);
    expect(harness.errors).toEqual([null]);
  });
});
