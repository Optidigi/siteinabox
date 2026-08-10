import { describe, expect, it } from 'vitest';
import { getIntakeBackPhase, intakeStepMeta } from '../src/components/intake/flow';
import type { IntakePhase } from '../src/components/intake/domain/types';

const phases: IntakePhase[] = [
  'lookup',
  'manual',
  'confirm',
  'content',
  'contact',
  'contactDetails',
  'visualLogo',
  'visualColors',
  'visualStyle',
  'finalDetails',
  'success',
];

describe('intake wizard phase contract', () => {
  it('keeps every runtime phase represented in the step metadata', () => {
    expect(Object.keys(intakeStepMeta)).toEqual(phases);
  });

  it('preserves the seven-step progress mapping', () => {
    expect(
      Object.fromEntries(phases.map((phase) => [phase, intakeStepMeta[phase].progress])),
    ).toEqual({
      lookup: null,
      manual: 1,
      confirm: 1,
      content: 2,
      contact: 3,
      contactDetails: 3,
      visualLogo: 4,
      visualColors: 5,
      visualStyle: 6,
      finalDetails: 7,
      success: null,
    });
  });

  it('preserves the current back-transition table', () => {
    expect([
      getIntakeBackPhase('lookup', null),
      getIntakeBackPhase('manual', null),
      getIntakeBackPhase('confirm', 'kvk'),
      getIntakeBackPhase('content', 'manual'),
      getIntakeBackPhase('content', 'kvk'),
      getIntakeBackPhase('contact', 'kvk'),
      getIntakeBackPhase('contactDetails', 'kvk'),
      getIntakeBackPhase('visualLogo', 'kvk'),
      getIntakeBackPhase('visualColors', 'kvk'),
      getIntakeBackPhase('visualStyle', 'kvk'),
      getIntakeBackPhase('finalDetails', 'kvk'),
      getIntakeBackPhase('success', 'kvk'),
    ]).toEqual([
      null,
      'lookup',
      'lookup',
      'manual',
      'confirm',
      'content',
      'contact',
      'contactDetails',
      'visualLogo',
      'visualColors',
      'visualStyle',
      null,
    ]);
  });
});
