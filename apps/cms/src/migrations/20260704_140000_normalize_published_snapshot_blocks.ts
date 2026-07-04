import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "published_site_snapshots" AS p
    SET "snapshot" = jsonb_set(
      p."snapshot",
      '{pages}',
      (
        SELECT jsonb_agg(
          CASE
            WHEN page ? 'blocks' THEN jsonb_set(
              page,
              '{blocks}',
              (
                SELECT jsonb_agg(
                  (
                    (block - 'variant' - 'tokens' - 'metadata')
                    || CASE
                      WHEN block ? 'designVariant' THEN '{}'::jsonb
                      WHEN block ? 'variant' THEN jsonb_build_object('designVariant', block->'variant')
                      ELSE '{}'::jsonb
                    END
                    || CASE
                      WHEN block ? 'analytics' THEN jsonb_build_object('analytics', (block->'analytics') - 'sectionVariant')
                      ELSE '{}'::jsonb
                    END
                  )
                  ORDER BY block_ord
                )
                FROM jsonb_array_elements(page->'blocks') WITH ORDINALITY AS b(block, block_ord)
              ),
              false
            )
            ELSE page
          END
          ORDER BY page_ord
        )
        FROM jsonb_array_elements(p."snapshot"->'pages') WITH ORDINALITY AS pg(page, page_ord)
      ),
      false
    )
    WHERE p."snapshot" @? '$.pages[*].blocks[*].variant'
       OR p."snapshot" @? '$.pages[*].blocks[*].tokens'
       OR p."snapshot" @? '$.pages[*].blocks[*].metadata'
       OR p."snapshot" @? '$.pages[*].blocks[*].analytics.sectionVariant';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`SELECT 1;`)
}
