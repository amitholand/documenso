-- Tamper-evident audit logs: every row stores the SHA-256 of its own content chained
-- to the previous row of the same envelope, and rows can no longer be edited or deleted.

ALTER TABLE "DocumentAuditLog" ADD COLUMN "chainIndex" INTEGER;
ALTER TABLE "DocumentAuditLog" ADD COLUMN "previousHash" TEXT;
ALTER TABLE "DocumentAuditLog" ADD COLUMN "hash" TEXT;

CREATE OR REPLACE FUNCTION document_audit_log_row_hash(row_data "DocumentAuditLog", previous_hash TEXT)
RETURNS TEXT AS $$
  SELECT encode(
    sha256(
      convert_to(
        concat_ws(
          '|',
          coalesce(previous_hash, ''),
          row_data."id",
          coalesce(row_data."envelopeId", ''),
          to_char(row_data."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS'),
          row_data."type",
          row_data."data"::text,
          coalesce(row_data."name", ''),
          coalesce(row_data."email", ''),
          coalesce(row_data."userId"::text, ''),
          coalesce(row_data."userAgent", ''),
          coalesce(row_data."ipAddress", '')
        ),
        'UTF8'
      )
    ),
    'hex'
  );
$$ LANGUAGE sql IMMUTABLE;

-- Backfill existing rows in their original order.
DO $$
DECLARE
  log_row "DocumentAuditLog";
  current_envelope TEXT := NULL;
  previous_hash TEXT := NULL;
  next_index INTEGER := 0;
BEGIN
  FOR log_row IN
    SELECT * FROM "DocumentAuditLog"
    WHERE "envelopeId" IS NOT NULL
    ORDER BY "envelopeId", "createdAt", "id"
  LOOP
    IF current_envelope IS DISTINCT FROM log_row."envelopeId" THEN
      current_envelope := log_row."envelopeId";
      previous_hash := NULL;
      next_index := 0;
    END IF;

    UPDATE "DocumentAuditLog"
    SET "chainIndex" = next_index,
        "previousHash" = previous_hash,
        "hash" = document_audit_log_row_hash(log_row, previous_hash)
    WHERE "id" = log_row."id"
    RETURNING "hash" INTO previous_hash;

    next_index := next_index + 1;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION document_audit_log_chain()
RETURNS TRIGGER AS $$
DECLARE
  previous_hash TEXT := NULL;
  previous_index INTEGER := -1;
BEGIN
  IF NEW."envelopeId" IS NOT NULL THEN
    -- Serialise inserts per envelope so the chain never forks.
    PERFORM pg_advisory_xact_lock(hashtext(NEW."envelopeId"));

    SELECT "hash", "chainIndex" INTO previous_hash, previous_index
    FROM "DocumentAuditLog"
    WHERE "envelopeId" = NEW."envelopeId" AND "chainIndex" IS NOT NULL
    ORDER BY "chainIndex" DESC
    LIMIT 1;

    NEW."chainIndex" := coalesce(previous_index, -1) + 1;
  END IF;

  NEW."previousHash" := previous_hash;
  NEW."hash" := document_audit_log_row_hash(NEW, previous_hash);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_audit_log_chain
BEFORE INSERT ON "DocumentAuditLog"
FOR EACH ROW EXECUTE FUNCTION document_audit_log_chain();

CREATE OR REPLACE FUNCTION document_audit_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  -- Escape hatch for maintenance and dev seeding: SET LOCAL documenso.allow_audit_log_changes = 'on'.
  IF current_setting('documenso.allow_audit_log_changes', true) = 'on' THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  -- Deleting an envelope detaches its audit logs (ON DELETE SET NULL); allow only that.
  IF TG_OP = 'UPDATE'
    AND OLD."envelopeId" IS NOT NULL
    AND NEW."envelopeId" IS NULL
    AND (NEW."id", NEW."createdAt", NEW."type", NEW."data", NEW."name", NEW."email", NEW."userId",
         NEW."userAgent", NEW."ipAddress", NEW."chainIndex", NEW."previousHash", NEW."hash")
      IS NOT DISTINCT FROM
        (OLD."id", OLD."createdAt", OLD."type", OLD."data", OLD."name", OLD."email", OLD."userId",
         OLD."userAgent", OLD."ipAddress", OLD."chainIndex", OLD."previousHash", OLD."hash")
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'DocumentAuditLog rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_audit_log_immutable
BEFORE UPDATE OR DELETE ON "DocumentAuditLog"
FOR EACH ROW EXECUTE FUNCTION document_audit_log_immutable();
