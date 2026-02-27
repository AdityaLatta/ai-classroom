import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Create enums
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE course_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE course_difficulty AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Add columns to courses
  await knex.schema.alterTable("courses", (table) => {
    table
      .specificType("status", "course_status")
      .notNullable()
      .defaultTo("DRAFT");
    table.text("thumbnail_url");
    table.string("category", 100);
    table.specificType("difficulty", "course_difficulty");
  });

  // Indexes for filtering
  await knex.raw("CREATE INDEX idx_courses_status ON courses (status)");
  await knex.raw("CREATE INDEX idx_courses_category ON courses (category)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP INDEX IF EXISTS idx_courses_category");
  await knex.raw("DROP INDEX IF EXISTS idx_courses_status");

  await knex.schema.alterTable("courses", (table) => {
    table.dropColumn("difficulty");
    table.dropColumn("category");
    table.dropColumn("thumbnail_url");
    table.dropColumn("status");
  });

  await knex.raw("DROP TYPE IF EXISTS course_difficulty");
  await knex.raw("DROP TYPE IF EXISTS course_status");
}
