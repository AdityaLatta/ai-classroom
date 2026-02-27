import { z } from "zod";
import { getDb, withTransaction } from "@/infra";
import {
  CourseModule,
  CreateModuleDTO,
  UpdateModuleDTO,
  ReorderModuleItem,
  IModuleRepository,
} from "./module.types";

const moduleRowSchema = z.object({
  id: z.string(),
  course_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  order: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

const MODULE_COLUMNS =
  'id, course_id, title, description, "order", created_at, updated_at';

export class ModuleRepository implements IModuleRepository {
  async create(
    courseId: string,
    dto: CreateModuleDTO,
    order: number,
  ): Promise<CourseModule> {
    const db = getDb();
    const result = await db.query(
      `INSERT INTO modules (course_id, title, description, "order")
       VALUES ($1, $2, $3, $4)
       RETURNING ${MODULE_COLUMNS}`,
      [courseId, dto.title, dto.description ?? null, order],
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(moduleId: string): Promise<CourseModule | null> {
    const db = getDb();
    const result = await db.query(
      `SELECT ${MODULE_COLUMNS} FROM modules WHERE id = $1`,
      [moduleId],
    );
    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async findByCourseId(courseId: string): Promise<CourseModule[]> {
    const db = getDb();
    const result = await db.query(
      `SELECT ${MODULE_COLUMNS} FROM modules WHERE course_id = $1 ORDER BY "order" ASC, created_at ASC`,
      [courseId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async update(
    moduleId: string,
    dto: UpdateModuleDTO,
  ): Promise<CourseModule | null> {
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

    if (updates.length === 0) {
      return this.findById(moduleId);
    }

    values.push(moduleId);
    const result = await db.query(
      `UPDATE modules SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING ${MODULE_COLUMNS}`,
      values,
    );

    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async delete(moduleId: string): Promise<boolean> {
    const db = getDb();
    const result = await db.query(`DELETE FROM modules WHERE id = $1`, [
      moduleId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async reorder(
    courseId: string,
    items: ReorderModuleItem[],
  ): Promise<CourseModule[]> {
    return withTransaction(async (client) => {
      for (const item of items) {
        await client.query(
          `UPDATE modules SET "order" = $1 WHERE id = $2 AND course_id = $3`,
          [item.order, item.id, courseId],
        );
      }

      const result = await client.query(
        `SELECT ${MODULE_COLUMNS} FROM modules WHERE course_id = $1 ORDER BY "order" ASC, created_at ASC`,
        [courseId],
      );
      return result.rows.map((row) => this.mapRow(row));
    });
  }

  async getNextOrder(courseId: string): Promise<number> {
    const db = getDb();
    const result = await db.query(
      `SELECT COALESCE(MAX("order"), -1) + 1 AS next_order FROM modules WHERE course_id = $1`,
      [courseId],
    );
    return parseInt(result.rows[0].next_order, 10);
  }

  private mapRow(row: Record<string, unknown>): CourseModule {
    const parsed = moduleRowSchema.parse(row);
    return {
      id: parsed.id,
      courseId: parsed.course_id,
      title: parsed.title,
      description: parsed.description,
      order: parsed.order,
      createdAt: parsed.created_at,
      updatedAt: parsed.updated_at,
    };
  }
}
