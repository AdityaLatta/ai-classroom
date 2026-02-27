import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE enrollment_status AS ENUM ('ACTIVE', 'DROPPED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.schema.createTable("enrollments", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table
      .uuid("course_id")
      .notNullable()
      .references("id")
      .inTable("courses")
      .onDelete("CASCADE");
    table
      .specificType("status", "enrollment_status")
      .notNullable()
      .defaultTo("ACTIVE");
    table.timestamp("enrolled_at", { useTz: true }).defaultTo(knex.fn.now());
    table.unique(["user_id", "course_id"]);
  });

  await knex.raw(
    "CREATE INDEX idx_enrollments_user_id ON enrollments (user_id)",
  );
  await knex.raw(
    "CREATE INDEX idx_enrollments_course_id ON enrollments (course_id)",
  );
  await knex.raw(
    "CREATE INDEX idx_enrollments_user_active ON enrollments (user_id) WHERE status = 'ACTIVE'",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("enrollments");
  await knex.raw("DROP TYPE IF EXISTS enrollment_status");
}
