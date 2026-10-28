# syntax=docker/dockerfile:1.28.0@sha256:bb22d9815c728170f72750f4e5b0d672e06176142e1d602c7e66c050100b7e5b
FROM golang:1.27.3-alpine@sha256:d200d2dd76b03a99b52651fd1325aff7dcd35422c35c01bac56571b0507f3deb AS native
RUN apk add --no-cache git
COPY ops/cloudflared /recipes
RUN sh /recipes/build.sh

# Reuse the current pinned publisher trust bundle, without shipping Node or its OS.
FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS certificates

FROM scratch AS runtime
COPY --from=native /out/cloudflared /usr/local/bin/cloudflared
COPY --from=native /out/notices/ /usr/local/share/cloudflared/notices/
COPY --from=native --chown=1000:1000 /out/tmp/ /tmp/
COPY --from=certificates /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
ENV PATH=/usr/local/bin SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt HOME=/tmp
USER 1000:1000
ENTRYPOINT ["/usr/local/bin/cloudflared", "--no-autoupdate"]

FROM runtime AS trust-proof
COPY --from=native /out/Test-Trust /test-trust
RUN ["/test-trust"]

FROM runtime
COPY --from=trust-proof /tmp/trust-proof.json /usr/local/share/cloudflared/trust-proof.json
