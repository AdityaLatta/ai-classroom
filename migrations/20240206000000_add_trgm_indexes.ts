import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Enable the pg_trgm extension for trigram-based similarity search
  await knex.raw("CREATE EXTENSION IF NOT EXISTS pg_trgm");

  // GIN indexes for fast ILIKE searches on courses
  await knex.raw(
    "CREATE INDEX IF NOT EXISTS idx_courses_title_trgm ON courses USING gin (title gin_trgm_ops)",
  );
  await knex.raw(
    "CREATE INDEX IF NOT EXISTS idx_courses_description_trgm ON courses USING gin (description gin_trgm_ops)",
  );

  // Add updated_at column to courses if it doesn't exist
  const hasUpdatedAt = await knex.schema.hasColumn("courses", "updated_at");
  if (!hasUpdatedAt) {
    await knex.schema.alterTable("courses", (table) => {
      table.timestamp("updated_at").defaultTo(knex.fn.now());
    });
    // Backfill existing rows
    await knex.raw("UPDATE courses SET updated_at = created_at WHERE updated_at IS NULL");
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP INDEX IF EXISTS idx_courses_title_trgm");
  await knex.raw("DROP INDEX IF EXISTS idx_courses_description_trgm");
  // Don't drop the extension as other things might depend on it
  // Don't drop updated_at to avoid data loss
}
