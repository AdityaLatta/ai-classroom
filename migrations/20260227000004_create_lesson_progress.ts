import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE progress_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.schema.createTable("lesson_progress", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table
      .uuid("lesson_id")
      .notNullable()
      .references("id")
      .inTable("lessons")
      .onDelete("CASCADE");
    table
      .specificType("status", "progress_status")
      .notNullable()
      .defaultTo("NOT_STARTED");
    table.integer("progress_percent").notNullable().defaultTo(0);
    table.timestamp("completed_at", { useTz: true });
    table
      .timestamp("last_accessed_at", { useTz: true })
      .defaultTo(knex.fn.now());
    table.unique(["user_id", "lesson_id"]);
  });

  // Check constraint for progress_percent
  await knex.raw(`
    ALTER TABLE lesson_progress
      ADD CONSTRAINT chk_progress_percent
      CHECK (progress_percent >= 0 AND progress_percent <= 100)
  `);

  await knex.raw(
    "CREATE INDEX idx_lesson_progress_user_id ON lesson_progress (user_id)",
  );
  await knex.raw(
    "CREATE INDEX idx_lesson_progress_lesson_id ON lesson_progress (lesson_id)",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("lesson_progress");
  await knex.raw("DROP TYPE IF EXISTS progress_status");
}
