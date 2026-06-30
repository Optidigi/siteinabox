import type {
  CompanyDetails,
  ConfirmationField,
  KvkAddress,
  KvkCompanyProfile,
} from "./types";

export function getPrimaryAddress(addresses: KvkAddress[]) {
  return (
    addresses.find(
      (address) =>
        !address.shielded &&
        address.value &&
        address.type?.toLowerCase() === "bezoekadres",
    ) ?? null
  );
}

export function getConfirmationFields(company: CompanyDetails) {
  const otherActivityFields: ConfirmationField[] = company.secondaryActivities
    .filter(Boolean)
    .map((activity, index) => {
      const key = `activity:${index}` as const;

      return {
        key,
        label: "Nevenactiviteit",
        value: activity,
        editable: true,
        deletable: true,
      };
    });
  const fields: ConfirmationField[] = [
    {
      key: "name",
      label: "Bedrijfsnaam",
      value: company.companyName,
      editable: true,
    },
    {
      key: "kvkNumber",
      label: "KVK-nummer",
      value: company.kvkNumber,
      editable: false,
    },
    {
      key: "address",
      label: "Bezoekadres",
      value: company.address,
      editable: true,
    },
    {
      key: "website",
      label: "Website",
      value: company.website,
      editable: true,
    },
    {
      key: "mainActivity",
      label: "Hoofdactiviteit",
      value: company.mainActivity,
      editable: true,
    },
    ...otherActivityFields,
  ];

  return fields.filter((field) => field.value || field.key === "name");
}

export function getCompanyDetailsFromProfile(profile: KvkCompanyProfile) {
  const primaryAddress = getPrimaryAddress(profile.addresses);
  const mainActivityIndex = profile.activities.findIndex(
    (activity) => activity.isMain,
  );
  const resolvedMainActivityIndex =
    mainActivityIndex >= 0 ? mainActivityIndex : 0;
  const mainActivity = profile.activities[resolvedMainActivityIndex] ?? null;

  return {
    source: "kvk" as const,
    companyName: profile.name,
    kvkNumber: profile.kvkNumber,
    address: primaryAddress?.value ?? "",
    website: profile.websites[0] ?? "",
    mainActivity: mainActivity?.description ?? "",
    secondaryActivities: profile.activities
      .map((activity, index) => ({ activity, index }))
      .filter(({ index }) => index !== resolvedMainActivityIndex)
      .map(({ activity }) => activity.description)
      .filter(Boolean),
  };
}
