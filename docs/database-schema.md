# Database Schema

## Overview

This document describes the PostgreSQL database schema for the AI Classroom (Jarvis) backend.

## Tables

### users

Stores user account information.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | UUID | PRIMARY KEY | uuid_generate_v4() | Unique identifier |
| email | VARCHAR(255) | NOT NULL, UNIQUE | - | User's email address |
| name | VARCHAR(255) | NOT NULL | - | User's display name |
| role | user_role | NOT NULL | 'STUDENT' | User's role in the system |
| created_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | Last update time |

**Indexes:**
- `idx_users_email` on `email`

### courses

Stores course information.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | UUID | PRIMARY KEY | uuid_generate_v4() | Unique identifier |
| title | VARCHAR(200) | NOT NULL | - | Course title |
| description | TEXT | NOT NULL | - | Course description |
| instructor_id | UUID | NOT NULL, FK | - | Reference to users.id |
| created_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | Last update time |

**Indexes:**
- `idx_courses_instructor_id` on `instructor_id`

**Foreign Keys:**
- `instructor_id` → `users(id)` ON DELETE CASCADE

## Enums

### user_role

Defines the possible roles a user can have.

| Value | Description |
|-------|-------------|
| STUDENT | Regular student user |
| INSTRUCTOR | Can create and manage courses |
| ADMIN | System administrator |

## Functions

### update_updated_at_column()

Trigger function that automatically updates the `updated_at` column to the current timestamp when a row is modified.

## Triggers

| Trigger | Table | Event | Function |
|---------|-------|-------|----------|
| update_users_updated_at | users | BEFORE UPDATE | update_updated_at_column() |
| update_courses_updated_at | courses | BEFORE UPDATE | update_updated_at_column() |

## Entity Relationship Diagram

```
┌─────────────────────┐
│       users         │
├─────────────────────┤
│ id (PK)             │
│ email               │
│ name                │
│ role                │
│ created_at          │
│ updated_at          │
└─────────┬───────────┘
          │
          │ 1:N
          │
┌─────────┴───────────┐
│      courses        │
├─────────────────────┤
│ id (PK)             │
│ title               │
│ description         │
│ instructor_id (FK)  │──→ users.id
│ created_at          │
│ updated_at          │
└─────────────────────┘
```

## Migrations

Migrations are managed using **Knex.js** (~1.5M weekly downloads). Migration files are TypeScript files located in the `migrations/` directory.

### Commands

```bash
# Run all pending migrations
npm run migrate:latest

# Rollback the last migration
npm run migrate:rollback

# Check migration status
npm run migrate:status

# Create a new migration
npm run migrate:make <migration-name>
```

### Migration History

| Migration | Description |
|-----------|-------------|
| 20240205000000_initial_schema | Creates users and courses tables with indexes and triggers |

### Creating New Migrations

```bash
npm run migrate:make add_enrollments_table
```

This creates a TypeScript file in `migrations/` with `up` and `down` functions:

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("enrollments", (table) => {
    table.uuid("id").primary();
    // ... columns
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("enrollments");
}
```

## Future Tables (Planned)

These tables may be added in future migrations:

- **enrollments** - Student course enrollments
- **lessons** - Course lessons/modules
- **assignments** - Course assignments
- **submissions** - Student assignment submissions
- **sessions** - Live classroom sessions (WebRTC)
- **messages** - Chat messages within sessions
