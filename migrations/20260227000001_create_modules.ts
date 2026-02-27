import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("modules", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table
      .uuid("course_id")
      .notNullable()
      .references("id")
      .inTable("courses")
      .onDelete("CASCADE");
    table.string("title", 200).notNullable();
    table.text("description");
    table.integer("order").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw("CREATE INDEX idx_modules_course_id ON modules (course_id)");
  await knex.raw(
    'CREATE INDEX idx_modules_course_order ON modules (course_id, "order")',
  );

  await knex.raw(`
    CREATE TRIGGER update_modules_updated_at
      BEFORE UPDATE ON modules
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    "DROP TRIGGER IF EXISTS update_modules_updated_at ON modules",
  );
  await knex.schema.dropTableIfExists("modules");
}
