#!/bin/sh
set -eu
root=${1:?Pass the assembled runtime root}
version=${2:?Pass the reviewed esbuild version}
binary=${3:?Pass the rebuilt binary}
case "$version" in 0.25.12|0.28.2) ;; *) echo 'Unexpected esbuild version' >&2; exit 1 ;; esac
platform="$root/node_modules/.pnpm/@esbuild+linux-x64@$version/node_modules/@esbuild/linux-x64/bin/esbuild"
convenience="$root/node_modules/.pnpm/esbuild@$version/node_modules/esbuild/bin/esbuild"
[ -x "$platform" ]
[ "$("$binary" --version)" = "$version" ]
targets=$(mktemp)
trap 'rm -f "$targets"' EXIT
find "$root" -type f -name esbuild > "$targets"
[ -s "$targets" ]
# Inspect every occurrence first, so an unexpected copy fails before mutation.
while IFS= read -r target; do
  case "$target" in "$platform"|"$convenience") ;; *) echo "Unexpected runtime esbuild copy: $target" >&2; exit 1 ;; esac
  [ "$("$target" --version)" = "$version" ]
done < "$targets"
while IFS= read -r target; do
  cp "$binary" "$target"
  chmod 0755 "$target"
  cmp -s "$binary" "$target"
  [ "$("$target" --version)" = "$version" ]
done < "$targets"
