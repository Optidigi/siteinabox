"use client"

import countriesAtlas from "world-atlas/countries-110m.json"
import { geoNaturalEarth1, geoPath } from "d3-geo"
import countries from "i18n-iso-countries"
import { feature } from "topojson-client"
import type { GeoCountryMetric } from "@/lib/analytics/queries"

import { z } from "zod"

const atlasGeometrySchema = z.union([
  z.object({ type: z.literal("Polygon"), arcs: z.array(z.array(z.number())) }),
  z.object({ type: z.literal("MultiPolygon"), arcs: z.array(z.array(z.array(z.number()))) }),
]).and(z.object({ id: z.union([z.string(), z.number()]).optional(), properties: z.object({ name: z.string().optional() }).optional() }))
const atlas = z.object({
  type: z.literal("Topology"),
  arcs: z.array(z.array(z.array(z.number()))),
  transform: z.object({ scale: z.tuple([z.number(), z.number()]), translate: z.tuple([z.number(), z.number()]) }).optional(),
  objects: z.object({ countries: z.object({ type: z.literal("GeometryCollection"), geometries: z.array(atlasGeometrySchema) }) }),
}).parse(countriesAtlas)

const bucketClass = (visitors: number, maxVisitors: number) => {
  if (visitors <= 0 || maxVisitors <= 0) return "fill-muted"
  const ratio = visitors / maxVisitors
  if (ratio >= 0.8) return "fill-primary"
  if (ratio >= 0.55) return "fill-primary/80"
  if (ratio >= 0.3) return "fill-primary/60"
  if (ratio >= 0.12) return "fill-primary/40"
  return "fill-primary/25"
}

export function GeoChoroplethMap({
  rows,
  noData,
}: {
  rows: GeoCountryMetric[]
  noData: string
}) {
  const countryByNumericCode = new Map(
    rows
      .map((row) => {
        const numeric = row.countryCode ? countries.alpha2ToNumeric(row.countryCode) : undefined
        return numeric ? [numeric, row] as const : null
      })
      .filter((row): row is readonly [string, GeoCountryMetric] => row != null),
  )
  const maxVisitors = Math.max(...rows.map((row) => row.visitors), 0)
  const projection = geoNaturalEarth1().fitSize([960, 480], { type: "Sphere" })
  const path = geoPath(projection)
  const countryFeatures = feature(atlas, atlas.objects.countries).features

  return (
    <div className="overflow-hidden rounded-md border border-border bg-muted/20">
      {rows.length === 0 ? (
        <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
          {noData}
        </div>
      ) : (
        <svg viewBox="0 0 960 480" className="aspect-video h-auto w-full" role="img" aria-label="Visitor geography map">
          {countryFeatures.map((country) => {
            const row = countryByNumericCode.get(String(country.id).padStart(3, "0"))
            const label = row
              ? `${row.countryName}: ${row.visitors} visitors`
              : String(country.properties?.name ?? "Unknown")
            const pathData = path(country)
            if (!pathData) return null
            return (
              <path
                key={String(country.id ?? label)}
                d={pathData}
                className={`${bucketClass(row?.visitors ?? 0, maxVisitors)} stroke-background outline-none transition-colors hover:fill-accent-foreground focus-visible:fill-accent-foreground`}
                tabIndex={row ? 0 : -1}
                role="img"
                aria-label={label}
              >
                <title>{label}</title>
              </path>
            )
          })}
        </svg>
      )}
    </div>
  )
}
