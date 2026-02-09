import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE refresh_tokens (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked BOOLEAN NOT NULL DEFAULT false,
      device_info VARCHAR(255),
      ip_address VARCHAR(45),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMPTZ
    )
  `);

  await knex.raw(`CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id)`);
  await knex.raw(`CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash)`);
  await knex.raw(`CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at)`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS refresh_tokens`);
}
