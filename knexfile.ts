import type { Knex } from "knex";
import dotenv from "dotenv";

dotenv.config();

function getSslConfig(): { rejectUnauthorized: boolean; ca?: string } | false {
  const dbSsl = process.env.DB_SSL === "true";
  const dbSslCa = process.env.DB_SSL_CA;
  const connectionString = process.env.DATABASE_URL || "";

  const requiresSsl = dbSsl || connectionString.includes("sslmode=");
  if (!requiresSsl) return false;

  return {
    rejectUnauthorized: !!dbSslCa,
    ...(dbSslCa ? { ca: dbSslCa } : {}),
  };
}

const sslConfig = getSslConfig();

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "pg",
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig,
    },
    migrations: {
      directory: "./migrations",
      extension: "ts",
    },
    seeds: {
      directory: "./seeds",
    },
  },

  test: {
    client: "pg",
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig,
    },
    migrations: {
      directory: "./migrations",
      extension: "ts",
    },
  },

  production: {
    client: "pg",
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig,
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: "./migrations",
      extension: "ts",
    },
  },
};

export default config;
