import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE lesson_type AS ENUM ('TEXT', 'VIDEO', 'LIVE_CLASS');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.schema.createTable("lessons", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table
      .uuid("module_id")
      .notNullable()
      .references("id")
      .inTable("modules")
      .onDelete("CASCADE");
    table.string("title", 200).notNullable();
    table.text("description");
    table.specificType("type", "lesson_type").notNullable().defaultTo("TEXT");
    table.text("content");
    table.text("video_url");
    table.integer("order").notNullable().defaultTo(0);
    table.integer("duration_minutes");
    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(
    "CREATE INDEX idx_lessons_module_id ON lessons (module_id)",
  );
  await knex.raw(
    'CREATE INDEX idx_lessons_module_order ON lessons (module_id, "order")',
  );

  await knex.raw(`
    CREATE TRIGGER update_lessons_updated_at
      BEFORE UPDATE ON lessons
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    "DROP TRIGGER IF EXISTS update_lessons_updated_at ON lessons",
  );
  await knex.schema.dropTableIfExists("lessons");
  await knex.raw("DROP TYPE IF EXISTS lesson_type");
}
