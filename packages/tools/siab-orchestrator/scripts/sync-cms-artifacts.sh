#!/bin/sh
# Sync compiled CMS canvas artifacts from a built site image into the
# Payload tenant data directory.
#
# Intended deployment order:
#   1. GitHub Actions publishes ghcr.io/optidigi/siteinabox-site-<slug>:latest.
#   2. Run this script on the Docker host that can write the tenant data dir.
#   3. Start/restart the site container with the tenant data dir mounted :ro.

set -eu

ENGINE="${CONTAINER_ENGINE:-docker}"
IMAGE=""
TENANT_DIR=""
SKIP_PULL=0

usage() {
  cat >&2 <<'EOF'
usage: scripts/sync-cms-artifacts.sh --image <image> --tenant-dir <path> [--engine docker|podman] [--skip-pull]

Examples:
  scripts/sync-cms-artifacts.sh \
    --image ghcr.io/optidigi/siteinabox-site-ami-care:latest \
    --tenant-dir /srv/data/saas/siab-payload/tenants/7

  CONTAINER_ENGINE=podman scripts/sync-cms-artifacts.sh --image ... --tenant-dir ...
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --image)
      IMAGE="${2:-}"
      shift 2
      ;;
    --tenant-dir)
      TENANT_DIR="${2:-}"
      shift 2
      ;;
    --engine)
      ENGINE="${2:-}"
      shift 2
      ;;
    --skip-pull)
      SKIP_PULL=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [ -z "$IMAGE" ] || [ -z "$TENANT_DIR" ]; then
  usage
  exit 2
fi

if ! command -v "$ENGINE" >/dev/null 2>&1; then
  echo "container engine not found: $ENGINE" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
CID=""
cleanup() {
  if [ -n "$CID" ]; then
    "$ENGINE" rm "$CID" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

if [ "$SKIP_PULL" -eq 0 ]; then
  "$ENGINE" pull "$IMAGE"
fi

CID="$("$ENGINE" create "$IMAGE")"
"$ENGINE" cp "$CID:/app/dist/cms/." "$TMP_DIR/"

if [ ! -f "$TMP_DIR/cms-editor.css" ]; then
  echo "image did not contain /app/dist/cms/cms-editor.css: $IMAGE" >&2
  exit 1
fi

mkdir -p "$TENANT_DIR"
cp -f "$TMP_DIR/cms-editor.css" "$TENANT_DIR/cms-editor.css"

if [ -d "$TMP_DIR/files" ]; then
  mkdir -p "$TENANT_DIR/files"
  cp -R "$TMP_DIR/files/." "$TENANT_DIR/files/"
fi

echo "synced CMS artifacts from $IMAGE"
echo "  css:   $TENANT_DIR/cms-editor.css"
if [ -d "$TENANT_DIR/files" ]; then
  echo "  files: $TENANT_DIR/files/"
fi
