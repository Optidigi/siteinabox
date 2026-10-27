#!/bin/sh
set -eu
# Closed set of reviewed build variants. No latest refs, arbitrary source URLs,
# application patches or stripped build metadata are accepted.
case "${1:-}" in
  esbuild-0.25.12) component=esbuild; version=0.25.12; tag=v0.25.12; commit=208f539945b145e7c9d6d844290f81c3fe5af320; repo=https://github.com/evanw/esbuild; package=./cmd/esbuild; license=LICENSE.md ;;
  esbuild-0.28.2) component=esbuild; version=0.28.2; tag=v0.28.2; commit=609683d892977362a0f99026cb74b96263d728a9; repo=https://github.com/evanw/esbuild; package=./cmd/esbuild; license=LICENSE.md ;;
  gosu-1.20) component=gosu; version=1.20; tag=1.20; commit=29b939aa5bd4dc588af765b8248f6e39150d2565; repo=https://github.com/tianon/gosu; package=.; license=LICENSE ;;
  *) echo 'Choose a reviewed native build variant' >&2; exit 1 ;;
esac
[ "$(go env GOVERSION)" = go1.27.3 ]
[ "$(go env GOOS)/$(go env GOARCH)" = linux/amd64 ]
recipes=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/source" "$work/modules" /out/notices
cd "$work/source"
git init -q
git remote add origin "$repo"
git fetch --quiet --depth 1 origin "refs/tags/$tag:refs/tags/$tag"
git checkout --quiet --detach "$commit"
[ "$(git rev-parse HEAD)" = "$commit" ]
[ -z "$(git status --porcelain)" ]
cp "$recipes/$component/derived.mod" "$work/modules/derived.mod"
cp "$recipes/$component/derived.sum" "$work/modules/derived.sum"
export CGO_ENABLED=0 GOTOOLCHAIN=local
# Use current toolchain defaults instead of the upstream legacy compatibility defaults.
if [ "$component" = esbuild ]; then go test -mod=readonly -modfile="$work/modules/derived.mod" ./internal/...; fi
if [ "$component" = gosu ]; then
  go build -trimpath -buildvcs=true -mod=readonly -modfile="$work/modules/derived.mod" -ldflags="-X main.version=$version" -o /out/gosu "$package"
else
  go build -trimpath -buildvcs=true -mod=readonly -modfile="$work/modules/derived.mod" -o /out/esbuild "$package"
fi
[ -z "$(git status --porcelain)" ]
/out/"$component" --version | grep -F "$version"
go version -m /out/"$component" > /out/notices/build-info.txt
grep -F 'go1.27.3' /out/notices/build-info.txt
grep -F "vcs.revision=$commit" /out/notices/build-info.txt
if grep -F 'vcs.modified=true' /out/notices/build-info.txt; then exit 1; fi
grep -F 'golang.org/x/sys' /out/notices/build-info.txt | grep -F 'v0.44.0'
cp "$license" /out/notices/upstream-LICENSE
cp "$(go env GOROOT)/LICENSE" /out/notices/Go-LICENSE
cp "$(go env GOMODCACHE)/golang.org/x/sys@v0.44.0/LICENSE" /out/notices/x-sys-LICENSE
if [ "$component" = gosu ]; then cp "$(go env GOMODCACHE)/github.com/moby/sys/user@v0.4.1/LICENSE" /out/notices/moby-user-LICENSE; fi
cp "$work/modules/derived.mod" "$work/modules/derived.sum" /out/notices/
printf 'component=%s\nversion=%s\nsource=%s\nrevision=%s\nvariant=first-party-security-rebuild\n' "$component" "$version" "$repo" "$commit" > /out/notices/provenance.txt
sha256sum /out/"$component" > /out/notices/binary.sha256
