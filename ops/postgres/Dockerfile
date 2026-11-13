# syntax=docker/dockerfile:1.28.0@sha256:bb22d9815c728170f72750f4e5b0d672e06176142e1d602c7e66c050100b7e5b
# First-party derived candidate; this is not the unchanged vendor image.
FROM golang:1.27.4-alpine@sha256:0a5f7fe796599ff487605987432e7619ae45beeb2fba4c2ce0b907879932aebf AS native-tools
RUN apk add --no-cache git
COPY ops/native-components /native-recipes
RUN sh /native-recipes/build.sh gosu-1.20

FROM postgres:18.6-alpine@sha256:10a5c69a83035ab5239f5620d708520e8b28f5aa1f2b20143e6024532edadfb5
RUN apk add --no-cache --upgrade brotli-libs=1.2.1-r0 libcurl=8.23.0-r0 libxslt=1.1.43-r4
COPY --from=native-tools /out/gosu /usr/local/bin/gosu
COPY --from=native-tools /out/notices/ /usr/local/share/native-notices/gosu/
RUN gosu --version | grep '1.20' \
 && test "$(gosu postgres id -u)" = "$(id -u postgres)"
# ENTRYPOINT, CMD, PGDATA, postgres UID/GID and volume declaration are inherited.
