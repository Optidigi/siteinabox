#!/bin/sh
set -eu
[ "$(go env GOVERSION)" = go1.27.3 ]
[ "$(go env GOOS)/$(go env GOARCH)" = linux/amd64 ]
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/source" "$work/modules" /out/notices /out/tmp
chmod 1777 /out/tmp
cd "$work/source"
git init -q
git remote add origin https://github.com/cloudflare/cloudflared
git fetch --quiet --depth 1 origin refs/tags/2026.10.5:refs/tags/2026.10.5
git checkout --quiet --detach 99b2eb2c0152862af2b1abf7c7b4e2170a46b9fe
[ "$(git rev-parse HEAD)" = 99b2eb2c0152862af2b1abf7c7b4e2170a46b9fe ]
cp /recipes/derived.mod /recipes/derived.sum "$work/modules/"
export CGO_ENABLED=0 GOTOOLCHAIN=local
go build -trimpath -buildvcs=true -mod=readonly -modfile="$work/modules/derived.mod" \
  -ldflags='-X main.Version=2026.10.5 -X main.BuildType=siab-security-rebuild -X main.BuildTime=2026-10-27T13:05:40Z -X github.com/cloudflare/cloudflared/metrics.Runtime=virtual -X github.com/cloudflare/cloudflared/cmd/cloudflared/updater.BuiltForPackageManager=siteinabox' \
  -o /out/cloudflared ./cmd/cloudflared
[ -z "$(git status --porcelain)" ]
go version -m /out/cloudflared > /out/notices/build-info.txt
grep -F 'github.com/go-jose/go-jose/v4' /out/notices/build-info.txt | grep -F 'v4.1.6'
grep -F 'vcs.revision=99b2eb2c0152862af2b1abf7c7b4e2170a46b9fe' /out/notices/build-info.txt
grep -F 'CGO_ENABLED=0' /out/notices/build-info.txt
if grep -F 'vcs.modified=true' /out/notices/build-info.txt; then exit 1; fi
cp LICENSE /out/notices/upstream-LICENSE
cp "$(go env GOROOT)/LICENSE" /out/notices/Go-LICENSE
cp "$(go env GOMODCACHE)/github.com/go-jose/go-jose/v4@v4.1.6/LICENSE" /out/notices/go-jose-LICENSE
cache=$(go env GOMODCACHE)
go list -mod=readonly -modfile="$work/modules/derived.mod" -m -f '{{if .Dir}}{{.Dir}}{{end}}' all |
while IFS= read -r directory; do
  case "$directory" in
    "$cache"/*)
      target="/out/notices/modules/${directory#"$cache"/}"
      mkdir -p "$target"
      find "$directory" -maxdepth 1 -type f \( -iname 'LICENSE*' -o -iname 'NOTICE*' \) -exec cp '{}' "$target/" \;
      ;;
  esac
done
cp "$work/modules/derived.mod" "$work/modules/derived.sum" /out/notices/
printf 'source=https://github.com/cloudflare/cloudflared\nrevision=99b2eb2c0152862af2b1abf7c7b4e2170a46b9fe\nvariant=siteinabox-security-rebuild\ngo-jose=4.1.6\n' > /out/notices/provenance.txt
go build -trimpath -o /out/Test-Trust /recipes/Test-Trust.go
