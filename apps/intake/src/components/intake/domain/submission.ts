import type { RawIntakeSubmission } from "@siteinabox/contracts/generation";
import type { IntakeFormValues } from "./types";

export type IntakeSubmitResult = {
  ok: boolean;
  reused?: boolean;
  status?: string;
  intakeSubmissionId?: string | number;
  error?: unknown;
};

const intakeSubmitEndpoint =
  import.meta.env.PUBLIC_INTAKE_SUBMIT_ENDPOINT ?? "/api/intake";

export const serializeIntakeSubmission = (
  values: IntakeFormValues,
): RawIntakeSubmission => ({
  submittedAt: new Date().toISOString(),
  source: "public-intake",
  company: {
    ...values.company,
  },
  content: {
    ...values.content,
    offers: values.content.offers.map((offer) => ({ value: offer.value })),
  },
  contact: {
    ...values.contact,
  },
  visual: {
    logo: {
      mode: values.visual.logo.mode,
      file: null,
      text: values.visual.logo.text,
    },
    color: {
      ...values.visual.color,
    },
    shape: values.visual.shape,
    typography: values.visual.typography,
  },
  finalDetails: {
    ...values.finalDetails,
  },
  domain: null,
  email: null,
  addOns: [],
  notes: values.content.notes || null,
});

export async function submitIntake(
  values: IntakeFormValues,
): Promise<IntakeSubmitResult> {
  const response = await fetch(intakeSubmitEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(serializeIntakeSubmission(values)),
  });

  let body: IntakeSubmitResult | null = null;
  try {
    body = (await response.json()) as IntakeSubmitResult;
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(
      typeof body?.error === "object" && body.error && "message" in body.error
        ? String(body.error.message)
        : "Je aanvraag kon niet worden verstuurd.",
    );
  }

  return body ?? { ok: true };
}
