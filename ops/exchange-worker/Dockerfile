# syntax=docker/dockerfile:1.28.0@sha256:bb22d9815c728170f72750f4e5b0d672e06176142e1d602c7e66c050100b7e5b
FROM ubuntu:24.04@sha256:68ee22004a9109b44973313b02ff7b1de250f1de0f5ecb628d73f579aaff33ac

ENV DEBIAN_FRONTEND=noninteractive \
    POWERSHELL_TELEMETRY_OPTOUT=1 \
    HOME=/home/exchange-worker \
    EXCHANGE_WORKER_LISTEN_URL=http://0.0.0.0:8081/

RUN apt-get update \
 && apt-get install --yes --no-install-recommends ca-certificates curl bind9-dnsutils \
 && rm -rf /var/lib/apt/lists/*

ARG POWERSHELL_VERSION=7.6.8
ARG POWERSHELL_DEB_SHA256=f687eb1a3ba7b22a1ff35d85893b64aec1045ff718f13ceb8e56c300d60494dc
RUN curl --fail --silent --show-error --location \
      "https://github.com/PowerShell/PowerShell/releases/download/v${POWERSHELL_VERSION}/powershell_${POWERSHELL_VERSION}-1.deb_amd64.deb" \
      --output /tmp/powershell.deb \
 && echo "${POWERSHELL_DEB_SHA256}  /tmp/powershell.deb" | sha256sum --check --status \
 && apt-get update \
 && apt-get install --yes --no-install-recommends /tmp/powershell.deb \
 && rm -f /tmp/powershell.deb \
 && rm -rf /var/lib/apt/lists/*

# The Gallery version-search endpoint can fail independently of package download.
# Fetch exact, publisher-hash-reviewed archives and include all module dependencies.
COPY modules.json Install-ExchangeModules.ps1 /tmp/exchange-worker-build/
RUN pwsh -NoLogo -NoProfile -NonInteractive -File /tmp/exchange-worker-build/Install-ExchangeModules.ps1 \
 && rm -rf /tmp/exchange-worker-build \
 && useradd --system --create-home --home-dir /home/exchange-worker --uid 10001 exchange-worker \
 && chown -R exchange-worker:exchange-worker /home/exchange-worker

COPY --chown=exchange-worker:exchange-worker Invoke-ExchangeWorker.ps1 /app/Invoke-ExchangeWorker.ps1
USER exchange-worker
WORKDIR /app
EXPOSE 8081
ENTRYPOINT ["pwsh", "-NoLogo", "-NoProfile", "-NonInteractive", "-File", "/app/Invoke-ExchangeWorker.ps1"]
