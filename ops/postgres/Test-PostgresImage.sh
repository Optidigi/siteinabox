#!/bin/sh
set -eu
candidate=${1:?Pass the owned PostgreSQL candidate image}
baseline=${2:?Pass the reviewed official PostgreSQL baseline}
case "$candidate" in siteinabox-postgres:*|ghcr.io/optidigi/siteinabox-postgres@sha256:*) ;; *) echo 'Expected an explicit owned candidate' >&2; exit 1 ;; esac
scope="siab-pg-native-$(cat /proc/sys/kernel/random/uuid)"
container="$scope-db"
volume="$scope-data"
backup=$(mktemp)
cleanup() {
  rm -f "$backup"
  if [ "$(docker inspect --format '{{index .Config.Labels "siteinabox.verification"}}' "$container" 2>/dev/null || true)" = "$scope" ]; then docker rm -f "$container" >/dev/null; fi
  if [ "$(docker volume inspect --format '{{index .Labels "siteinabox.verification"}}' "$volume" 2>/dev/null || true)" = "$scope" ]; then docker volume rm "$volume" >/dev/null; fi
}
trap cleanup EXIT
docker volume create --label "siteinabox.verification=$scope" "$volume" >/dev/null
[ "$(docker volume inspect --format '{{index .Labels "siteinabox.verification"}}' "$volume")" = "$scope" ]
start() {
  image=$1; shift
  docker run -d --name "$container" --label "siteinabox.verification=$scope" --network none --memory 1g --cpus 1 \
    --mount "type=volume,src=$volume,dst=/var/lib/postgresql" \
    -e POSTGRES_USER=fixture -e POSTGRES_PASSWORD=synthetic-only -e POSTGRES_DB=native_test "$@" "$image" >/dev/null
  attempt=0
  until docker exec -e PGPASSWORD=synthetic-only "$container" psql -X -h 127.0.0.1 -U fixture -d native_test -Atc 'SELECT current_database()' 2>/dev/null | grep -qx native_test; do
    attempt=$((attempt+1)); [ "$attempt" -lt 30 ] || { docker logs "$container"; exit 1; }; sleep 1
  done
}
query() { docker exec "$container" psql -X -U fixture -d native_test -v ON_ERROR_STOP=1 -Atc "$1"; }
stop() { docker stop --time 30 "$container" >/dev/null; [ "$(docker inspect --format '{{.State.ExitCode}}' "$container")" = 0 ]; docker rm "$container" >/dev/null; }
start "$baseline"
query "CREATE TABLE sentinel(id integer PRIMARY KEY, value text NOT NULL); INSERT INTO sentinel VALUES (1,'native-rebuild-fixture')" >/dev/null
before=$(query 'SELECT md5(value) FROM sentinel WHERE id=1')
owner=$(docker exec "$container" stat -c '%u:%g' /var/lib/postgresql/18/docker)
stop
start "$candidate"
[ "$(query 'SHOW server_version_num')" = 180006 ]
[ "$(query 'SELECT md5(value) FROM sentinel WHERE id=1')" = "$before" ]
[ "$(docker exec "$container" stat -c '%u:%g' /var/lib/postgresql/18/docker)" = "$owner" ]
[ "$(docker exec "$container" id -u postgres)" = 70 ]
[ "$(docker exec "$container" stat -c '%u' /proc/1)" = 70 ]
# Restore through PostgreSQL's public dump/restore tools into a fresh database.
docker exec "$container" pg_dump -U fixture -d native_test --format=custom > "$backup"
query 'CREATE DATABASE native_restore' >/dev/null
docker exec -i "$container" pg_restore -U fixture -d native_restore --exit-on-error < "$backup"
[ "$(docker exec "$container" psql -X -U fixture -d native_restore -Atc 'SELECT md5(value) FROM sentinel WHERE id=1')" = "$before" ]
stop
start "$candidate" --user 70:70
[ "$(query 'SELECT md5(value) FROM sentinel WHERE id=1')" = "$before" ]
stop
# Same-major rollback must preserve the populated data volume as well.
start "$baseline"
[ "$(query 'SELECT md5(value) FROM sentinel WHERE id=1')" = "$before" ]
stop
printf '%s\n' 'PASS: root privilege drop, populated volume replacement, UID/GID preservation, nonroot restart, logical restore, same-major rollback and graceful signals'
