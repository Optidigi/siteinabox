import type { RawIntakeSubmission } from "@siteinabox/contracts/generation";
import { intakeLegalStatements } from "./constants";
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
  recordedAt = new Date().toISOString(),
): RawIntakeSubmission => {
  if (!values.legal.businessUseAccepted) {
    throw new Error("De zakelijke verklaring is verplicht.");
  }
  if (!values.legal.termsAccepted) {
    throw new Error("Acceptatie van de algemene voorwaarden is verplicht.");
  }

  return {
    submittedAt: recordedAt,
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
    legal: {
      businessUseDeclaration: {
        accepted: true,
        statementVersion: intakeLegalStatements.businessUse.version,
        recordedAt,
      },
      termsAcceptance: {
        accepted: true,
        documentVersion: intakeLegalStatements.terms.documentVersion,
        acceptanceVersion: intakeLegalStatements.terms.acceptanceVersion,
        statementVersion: intakeLegalStatements.terms.statementVersion,
        contentHash: intakeLegalStatements.terms.contentHash,
        url: intakeLegalStatements.terms.url,
        recordedAt,
      },
      marketingConsent: {
        granted: values.legal.marketingOptIn,
        statementVersion: intakeLegalStatements.marketing.version,
        recordedAt,
      },
      privacyNotice: {
        documentVersion: intakeLegalStatements.privacyNotice.documentVersion,
        url: intakeLegalStatements.privacyNotice.url,
      },
    },
    domain: null,
    email: null,
    addOns: [],
    notes: values.content.notes || null,
  };
};

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
