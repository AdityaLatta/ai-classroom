import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Enable UUID extension
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Create user_role enum
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('STUDENT', 'INSTRUCTOR', 'ADMIN');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create users table
  await knex.schema.createTable("users", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.string("email", 255).notNullable().unique();
    table.string("name", 255).notNullable();
    table.specificType("role", "user_role").notNullable().defaultTo("STUDENT");
    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

    table.index("email");
  });

  // Create courses table
  await knex.schema.createTable("courses", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.string("title", 200).notNullable();
    table.text("description").notNullable();
    table
      .uuid("instructor_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

    table.index("instructor_id");
  });

  // Create function for auto-updating updated_at
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  // Create triggers for updated_at
  await knex.raw(`
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);

  await knex.raw(`
    CREATE TRIGGER update_courses_updated_at
      BEFORE UPDATE ON courses
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop triggers
  await knex.raw("DROP TRIGGER IF EXISTS update_courses_updated_at ON courses");
  await knex.raw("DROP TRIGGER IF EXISTS update_users_updated_at ON users");

  // Drop function
  await knex.raw("DROP FUNCTION IF EXISTS update_updated_at_column()");

  // Drop tables (order matters due to foreign key)
  await knex.schema.dropTableIfExists("courses");
  await knex.schema.dropTableIfExists("users");

  // Drop enum
  await knex.raw("DROP TYPE IF EXISTS user_role");
}
