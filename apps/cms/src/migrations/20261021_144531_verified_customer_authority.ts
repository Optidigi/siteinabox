import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE preview_auth_users ADD COLUMN "firstVerifiedAt" timestamptz;
    ALTER TABLE preview_auth_users ADD COLUMN "verificationHistoryUnknown" boolean NOT NULL DEFAULT false;
    UPDATE preview_auth_users SET "verificationHistoryUnknown"=true;
    CREATE FUNCTION siab_record_first_verification() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.email := lower(btrim(NEW.email));
      IF TG_OP = 'INSERT' THEN
        NEW."verificationHistoryUnknown" := false;
        NEW."firstVerifiedAt" := CASE WHEN NEW."emailVerified" THEN clock_timestamp() ELSE NULL END;
      ELSE
        NEW."verificationHistoryUnknown" := OLD."verificationHistoryUnknown";
        IF OLD."firstVerifiedAt" IS NOT NULL AND NEW.email IS DISTINCT FROM OLD.email THEN
          RAISE EXCEPTION 'Verified customer email cannot be substituted';
        END IF;
        NEW."firstVerifiedAt" := OLD."firstVerifiedAt";
        IF OLD."firstVerifiedAt" IS NULL AND NOT OLD."verificationHistoryUnknown" AND NOT OLD."emailVerified" AND NEW."emailVerified" THEN
          NEW."firstVerifiedAt" := clock_timestamp();
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER siab_first_verification BEFORE INSERT OR UPDATE ON preview_auth_users
      FOR EACH ROW EXECUTE FUNCTION siab_record_first_verification();
    CREATE UNIQUE INDEX preview_auth_users_normalized_email_idx ON preview_auth_users (lower(btrim(email)));
    CREATE UNIQUE INDEX users_normalized_email_idx ON users (lower(btrim(email)));
    CREATE UNIQUE INDEX builder_sessions_normalized_email_idx ON builder_sessions (lower(btrim(customer_email)));
    CREATE UNIQUE INDEX users_single_membership_idx ON users_tenants (_parent_id);
    ALTER TABLE customer_accounts ADD CONSTRAINT customer_accounts_normalized_email CHECK (email = lower(btrim(email)));
    CREATE FUNCTION siab_preserve_customer_binding() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE verified_source preview_auth_users%ROWTYPE;
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(NEW.email, 0));
        SELECT * INTO verified_source FROM preview_auth_users WHERE id=NEW.preview_user_id;
        IF NOT FOUND OR NOT verified_source."emailVerified" OR verified_source."verificationHistoryUnknown" OR verified_source."firstVerifiedAt" IS NULL
          OR verified_source.email IS DISTINCT FROM NEW.email
          OR date_trunc('milliseconds', verified_source."firstVerifiedAt") IS DISTINCT FROM NEW.verified_at THEN
          RAISE EXCEPTION 'A matching verified source and original verification instant are required';
        END IF;
        IF EXISTS (SELECT 1 FROM users WHERE lower(btrim(email))=NEW.email) THEN
          RAISE EXCEPTION 'E_CUSTOMER_EXISTING_MEMBERSHIP';
        END IF;
        RETURN NEW;
      END IF;
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Verified customer identity must be retained';
      END IF;
      IF NEW.email IS DISTINCT FROM OLD.email OR NEW.preview_user_id IS DISTINCT FROM OLD.preview_user_id
        OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
        OR (OLD.tenant_id IS NOT NULL AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id)
        OR (OLD.payload_user_id IS NOT NULL AND NEW.payload_user_id IS DISTINCT FROM OLD.payload_user_id) THEN
        RAISE EXCEPTION 'Verified customer identity and existing binding are immutable';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER siab_customer_binding BEFORE INSERT OR UPDATE OR DELETE ON customer_accounts
      FOR EACH ROW EXECUTE FUNCTION siab_preserve_customer_binding();
    CREATE FUNCTION siab_bind_customer_membership() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE member_email text; member_role text; account customer_accounts%ROWTYPE;
    BEGIN
      SELECT lower(btrim(email)), role INTO member_email, member_role FROM users WHERE id=NEW._parent_id;
      PERFORM pg_advisory_xact_lock(hashtextextended(member_email, 0));
      SELECT * INTO account FROM customer_accounts WHERE email=member_email FOR UPDATE;
      IF FOUND THEN
        IF account.revoked_at IS NOT NULL OR member_role NOT IN ('owner','editor','viewer')
          OR (account.tenant_id IS NOT NULL AND account.tenant_id IS DISTINCT FROM NEW.tenant_id) THEN
          RAISE EXCEPTION 'E_CUSTOMER_WORKSPACE_CONFLICT';
        END IF;
        UPDATE customer_accounts SET tenant_id=NEW.tenant_id, payload_user_id=NEW._parent_id WHERE id=account.id;
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER siab_customer_membership AFTER INSERT OR UPDATE ON users_tenants
      FOR EACH ROW EXECUTE FUNCTION siab_bind_customer_membership();
    CREATE FUNCTION siab_preserve_bound_member_email() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF lower(btrim(NEW.email)) IS DISTINCT FROM lower(btrim(OLD.email))
        AND EXISTS (SELECT 1 FROM customer_accounts WHERE email=lower(btrim(OLD.email))) THEN
        RAISE EXCEPTION 'Verified customer email cannot be substituted';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER siab_bound_member_email BEFORE UPDATE OF email ON users
      FOR EACH ROW EXECUTE FUNCTION siab_preserve_bound_member_email();
    CREATE FUNCTION siab_revoke_customer_credentials() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.revoked_at IS NOT NULL THEN
        DELETE FROM preview_auth_sessions WHERE "userId"=NEW.preview_user_id;
        IF NEW.payload_user_id IS NOT NULL THEN
          DELETE FROM users_sessions WHERE _parent_id=NEW.payload_user_id;
          UPDATE users SET api_key=NULL, api_key_index=NULL, enable_a_p_i_key=false WHERE id=NEW.payload_user_id;
          DELETE FROM better_auth_sessions WHERE "userId" IN
            (SELECT id FROM better_auth_users WHERE "payloadUserId"=NEW.payload_user_id::text);
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER siab_customer_credential_revocation AFTER UPDATE OF revoked_at ON customer_accounts
      FOR EACH ROW EXECUTE FUNCTION siab_revoke_customer_credentials();
  `);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM customer_accounts) OR EXISTS (SELECT 1 FROM preview_auth_users WHERE "firstVerifiedAt" IS NOT NULL) THEN
        RAISE EXCEPTION 'Preserve verified account identity; use a reviewed forward recovery before rollback';
      END IF;
    END $$;
    DROP TRIGGER siab_customer_binding ON customer_accounts;
    DROP FUNCTION siab_preserve_customer_binding();
    DROP TRIGGER siab_customer_membership ON users_tenants;
    DROP FUNCTION siab_bind_customer_membership();
    DROP TRIGGER siab_bound_member_email ON users;
    DROP FUNCTION siab_preserve_bound_member_email();
    DROP TRIGGER siab_customer_credential_revocation ON customer_accounts;
    DROP FUNCTION siab_revoke_customer_credentials();
    ALTER TABLE customer_accounts DROP CONSTRAINT customer_accounts_normalized_email;
    DROP INDEX users_single_membership_idx;
    DROP INDEX builder_sessions_normalized_email_idx;
    DROP INDEX users_normalized_email_idx;
    DROP INDEX preview_auth_users_normalized_email_idx;
    DROP TRIGGER siab_first_verification ON preview_auth_users;
    DROP FUNCTION siab_record_first_verification();
    ALTER TABLE preview_auth_users DROP COLUMN "firstVerifiedAt";
    ALTER TABLE preview_auth_users DROP COLUMN "verificationHistoryUnknown";
  `);
}
