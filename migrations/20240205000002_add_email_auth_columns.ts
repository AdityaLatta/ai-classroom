import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Create auth_provider enum
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE auth_provider AS ENUM ('google', 'email');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Add columns to users table
  await knex.raw(`
    ALTER TABLE users
      ADD COLUMN password_hash VARCHAR(255),
      ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN auth_provider auth_provider NOT NULL DEFAULT 'google'
  `);

  // Existing Google OAuth users are already verified
  await knex.raw(
    `UPDATE users SET email_verified = true WHERE auth_provider = 'google'`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS password_hash,
      DROP COLUMN IF EXISTS email_verified,
      DROP COLUMN IF EXISTS auth_provider
  `);
  await knex.raw(`DROP TYPE IF EXISTS auth_provider`);
}
