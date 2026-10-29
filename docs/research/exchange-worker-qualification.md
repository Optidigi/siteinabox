# Exchange worker candidate qualification

> Historical candidate report. The publication exclusion and incomplete-coverage
> conclusions below describe the earlier candidate, not the current release.
> The canonical pipeline now verifies and publishes the worker under
> [image publication](../runbooks/image-publication.md) and the approved
> [risk policy](../dependency-security.md).

## Current release evidence refresh (2026-10-29)

The worker archive from source `7bbc58e31d747a4ff2ab3544f29d1df19bbe294b`,
canonical verification run `40931934049`, retains complete runtime/managed
inventory and the unchanged two Pkcs findings. Its explicit module-import and
private-DLL LoadFrom measurement still resolve only to the default host Pkcs
10.0.14. The Windows-only applicability evidence remains unchanged. No DLL has
been removed, substituted or excluded from scanning.

Adding the shared-inbox worker operation changed the worker-entrypoint hash and
therefore its native evidence fingerprint. The final publisher correctly blocked
stale nonaffected bindings even though CI passed. The two exact worker records
in `docs/dependency-security.json` are rebound to fingerprint
`df6936277291e5ee14f469caa77687a96892eb7d592da8552060b50bb1dc2237`
after reviewing the new source, inventory and actual assembly-binding receipt.
Severity, advisory facts, justification, deadlines and release controls remain
unchanged. This documentation refresh does not itself publish or deploy an image.

The retained archive SHA256 is
`9e897078e40b30bc67edb1c2572c19c06985af8f2f430b44b06287db996f6fdc`;
its config/image ID is
`sha256:a4bef7ae20532851d4120e0e425437f490ae9d5d340d92c5975aede98b18f49f`.
The worker entrypoint SHA256 is
`5734cfe711b57064ff115dccdf5137b0fc78b94ca42f7eeb8e20eaf249dd3cce`.
Canonical publication must still rescan and validate these exact bytes with the
current policy, successful exact-source CI and configured owner approval.


Tracking: [worker ticket #136](https://github.com/Optidigi/siteinabox/issues/136),
under [release spec #132](https://github.com/Optidigi/siteinabox/issues/132).
This is diagnostic evidence, not security admission or publication approval.

## Candidate and observed behavior

Source `e2312baef70e675d64d4a9256086d46314c6b5d7` builds the pinned Ubuntu 24.04
base with inherited package upgrades, PowerShell 7.6.9 and unchanged EXO 3.10.1.
The official PowerShell DEB matches SHA256
`491b1a51e257e2ac86af33e3a4dc9aa91adb1b3926a57967af39d9a1ca38dc79`.
The extracted runtime executes as .NET 10.0.14. Packaged offline worker,
installer and inventory contracts pass, as do authenticated HTTP health and
unauthenticated 401 rejection. Tests use disposable resources with networking
disabled and no published ports; no Microsoft connection or provider write occurs.

The recursive inventory retains 750 runtime/module file records, including
duplicate DLLs, two unresolved compatibility-library links and 12 non-managed
DLLs requiring native/package mapping. The complete dpkg
inventory retains 121 packages. Managed assembly versions alone do not identify
servicing level; file/product metadata is retained separately. Unresolved links
have target metadata and no invented content hash. Independent native coverage
and publisher mapping remain incomplete.

## Remaining findings

The exact candidate archive scan enumerates 32 Ubuntu findings and two .NET
findings. PowerShell's Pkcs DLL reports product version 10.0.14, but EXO's separate
`netCore/System.Security.Cryptography.Pkcs.dll` reports 10.0.0. Its dependency
manifest independently identifies the same affected version. Thus upgrading
PowerShell does not remediate EXO's bundled copy.

Microsoft identifies [CVE-2026-84008](https://github.com/dotnet/runtime/security/advisories/GHSA-846f-f764-76mx)
as affecting Linux, while [CVE-2026-70162](https://github.com/dotnet/runtime/security/advisories/GHSA-2fmv-rv2c-59x7)
is Windows-only. The latter applicability distinction does not clear the former
or override the current enumerated-finding gate. No finding is suppressed.

The [PowerShell release](https://github.com/PowerShell/PowerShell/releases/tag/v7.6.9)
provides package hashes. The actual package's runtime configuration and execution
confirm .NET 10.0.14, the patched .NET 10 version in the
[Brotli advisory](https://github.com/dotnet/runtime/security/advisories/GHSA-p3jp-9v83-76w9).
This does not prove every module/native byte is fixed. Prefer a vendor-serviced
EXO package; no supported individual-DLL substitution has been established.

## Retained identities and limits

- Archive SHA256: `1de00fcbb7c7167ffff5f8d59ac39cc2505d6420ae4442bef992dab868dafd99`.
- Runtime inventory SHA256: `8abac0de2d84c9ee9f6e4c2bee9c8f962b7bdd26912f4d543803897614e04856`.
- Dpkg inventory SHA256: `fdfdfb1e554b44e9c395536b6f98c01da5452bb9bbf724d6888d8d769ddc9233`.
- Archive config: `sha256:8d44d52308b9b20970d7d93ab1d6a1f654ea1810666bfa1be21d978a2c172233`.
- Observed Docker image ID: `sha256:dc01b6c9142fe01e9ce9874e75a2cbe52b28dfeb6402d4940afe7a07c9762b9c`.

Archive config identity and observed Docker identity are recorded separately;
publication still requires their supported reconciliation. Neither is silently
substituted for the other. Raw archive, inventory, inspect, scan and scanner logs
are retained under ignored `artifacts/worker-candidate-e2312bae/`.
Trivy 0.76.0 was publisher-checksum verified through the existing preparation
path; its retained database metadata was within 24 hours for this diagnostic.
This scan does not establish complete .NET/native analyzer coverage.

The worker is still excluded from controlled publication. Ticket #136 remains
open for remediation, complete coverage, identity admission and publisher
integration. Expired global security review and other image blockers also remain.
