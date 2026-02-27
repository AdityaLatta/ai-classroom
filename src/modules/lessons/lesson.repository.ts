import { z } from "zod";
import { getDb, withTransaction } from "@/infra";
import {
  Lesson,
  CreateLessonDTO,
  UpdateLessonDTO,
  ReorderLessonItem,
  ILessonRepository,
} from "./lesson.types";

const lessonRowSchema = z.object({
  id: z.string(),
  module_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  type: z.string(),
  content: z.string().nullable(),
  video_url: z.string().nullable(),
  order: z.number(),
  duration_minutes: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

const LESSON_COLUMNS =
  'id, module_id, title, description, type, content, video_url, "order", duration_minutes, created_at, updated_at';

export class LessonRepository implements ILessonRepository {
  async create(
    moduleId: string,
    dto: CreateLessonDTO,
    order: number,
  ): Promise<Lesson> {
    const db = getDb();
    const result = await db.query(
      `INSERT INTO lessons (module_id, title, description, type, content, video_url, "order", duration_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${LESSON_COLUMNS}`,
      [
        moduleId,
        dto.title,
        dto.description ?? null,
        dto.type,
        dto.content ?? null,
        dto.videoUrl ?? null,
        order,
        dto.durationMinutes ?? null,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(lessonId: string): Promise<Lesson | null> {
    const db = getDb();
    const result = await db.query(
      `SELECT ${LESSON_COLUMNS} FROM lessons WHERE id = $1`,
      [lessonId],
    );
    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async findByModuleId(moduleId: string): Promise<Lesson[]> {
    const db = getDb();
    const result = await db.query(
      `SELECT ${LESSON_COLUMNS} FROM lessons WHERE module_id = $1 ORDER BY "order" ASC, created_at ASC`,
      [moduleId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async update(
    lessonId: string,
    dto: UpdateLessonDTO,
  ): Promise<Lesson | null> {
    const db = getDb();
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (dto.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(dto.title);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(dto.description);
    }
    if (dto.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(dto.type);
    }
    if (dto.content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(dto.content);
    }
    if (dto.videoUrl !== undefined) {
      updates.push(`video_url = $${paramIndex++}`);
      values.push(dto.videoUrl);
    }
    if (dto.durationMinutes !== undefined) {
      updates.push(`duration_minutes = $${paramIndex++}`);
      values.push(dto.durationMinutes);
    }

    if (updates.length === 0) {
      return this.findById(lessonId);
    }

    values.push(lessonId);
    const result = await db.query(
      `UPDATE lessons SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING ${LESSON_COLUMNS}`,
      values,
    );

    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async delete(lessonId: string): Promise<boolean> {
    const db = getDb();
    const result = await db.query(`DELETE FROM lessons WHERE id = $1`, [
      lessonId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async reorder(
    moduleId: string,
    items: ReorderLessonItem[],
  ): Promise<Lesson[]> {
    return withTransaction(async (client) => {
      for (const item of items) {
        await client.query(
          `UPDATE lessons SET "order" = $1 WHERE id = $2 AND module_id = $3`,
          [item.order, item.id, moduleId],
        );
      }

      const result = await client.query(
        `SELECT ${LESSON_COLUMNS} FROM lessons WHERE module_id = $1 ORDER BY "order" ASC, created_at ASC`,
        [moduleId],
      );
      return result.rows.map((row) => this.mapRow(row));
    });
  }

  async getNextOrder(moduleId: string): Promise<number> {
    const db = getDb();
    const result = await db.query(
      `SELECT COALESCE(MAX("order"), -1) + 1 AS next_order FROM lessons WHERE module_id = $1`,
      [moduleId],
    );
    return parseInt(result.rows[0].next_order, 10);
  }

  private mapRow(row: Record<string, unknown>): Lesson {
    const parsed = lessonRowSchema.parse(row);
    return {
      id: parsed.id,
      moduleId: parsed.module_id,
      title: parsed.title,
      description: parsed.description,
      type: parsed.type as Lesson["type"],
      content: parsed.content,
      videoUrl: parsed.video_url,
      order: parsed.order,
      durationMinutes: parsed.duration_minutes,
      createdAt: parsed.created_at,
      updatedAt: parsed.updated_at,
    };
  }
}
