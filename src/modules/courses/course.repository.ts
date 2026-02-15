import { z } from "zod";
import { getDb } from "../../infra/db";
import { CreateCourseDTO, UpdateCourseDTO, Course, ListCoursesOptions, ICourseRepository } from "./course.types";
import { PaginatedResult } from "../../utils/pagination";
import { escapeLikePattern } from "../../utils/sanitize";

const courseRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  instructor_id: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

const COURSE_COLUMNS = "id, title, description, instructor_id, created_at, updated_at";
const MAX_LIMIT = 100;

export class CourseRepository implements ICourseRepository {
  async createCourse(
    instructorId: string,
    dto: CreateCourseDTO,
  ): Promise<Course> {
    const db = getDb();
    const result = await db.query(
      `INSERT INTO courses (title, description, instructor_id)
       VALUES ($1, $2, $3)
       RETURNING ${COURSE_COLUMNS}`,
      [dto.title, dto.description, instructorId],
    );

    return this.mapRow(result.rows[0]);
  }

  async findById(courseId: string): Promise<Course | null> {
    const db = getDb();
    const result = await db.query(
      `SELECT ${COURSE_COLUMNS} FROM courses WHERE id = $1`,
      [courseId],
    );

    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async findAll(options: ListCoursesOptions): Promise<PaginatedResult<Course>> {
    const db = getDb();
    const { offset, cursor, filters } = options;
    const limit = Math.min(options.limit, MAX_LIMIT);

    // Build WHERE conditions for the data query
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (cursor) {
      conditions.push(`created_at < $${paramIndex}`);
      params.push(cursor);
      paramIndex++;
    }

    if (filters?.search) {
      const escaped = escapeLikePattern(filters.search);
      conditions.push(
        `(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`,
      );
      params.push(`%${escaped}%`);
      paramIndex++;
    }

    if (filters?.instructorId) {
      conditions.push(`instructor_id = $${paramIndex}`);
      params.push(filters.instructorId);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Build count query separately (excludes cursor filter for accurate total)
    const countConditions: string[] = [];
    const countParams: unknown[] = [];
    let countParamIndex = 1;

    if (filters?.search) {
      const escaped = escapeLikePattern(filters.search);
      countConditions.push(
        `(title ILIKE $${countParamIndex} OR description ILIKE $${countParamIndex})`,
      );
      countParams.push(`%${escaped}%`);
      countParamIndex++;
    }

    if (filters?.instructorId) {
      countConditions.push(`instructor_id = $${countParamIndex}`);
      countParams.push(filters.instructorId);
      countParamIndex++;
    }

    const countWhere =
      countConditions.length > 0 ? `WHERE ${countConditions.join(" AND ")}` : "";
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM courses ${countWhere}`,
      countParams,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const dataParams = [...params, limit + 1];
    const result = await db.query(
      `SELECT ${COURSE_COLUMNS} FROM courses ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex}`,
      dataParams,
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const data = rows.map((row) => this.mapRow(row));

    const nextCursor = hasMore && data.length > 0
      ? data[data.length - 1].createdAt.toISOString()
      : undefined;

    return {
      data,
      meta: {
        total,
        limit,
        offset,
        hasMore,
        ...(nextCursor ? { nextCursor } : {}),
      },
    };
  }

  async update(courseId: string, dto: UpdateCourseDTO): Promise<Course | null> {
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
      return this.findById(courseId);
    }

    updates.push(`updated_at = NOW()`);
    values.push(courseId);

    const result = await db.query(
      `UPDATE courses SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING ${COURSE_COLUMNS}`,
      values,
    );

    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async delete(courseId: string): Promise<boolean> {
    const db = getDb();
    const result = await db.query(
      `DELETE FROM courses WHERE id = $1`,
      [courseId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Maps a database row to a Course domain object. */
  private mapRow(row: Record<string, unknown>): Course {
    const parsed = courseRowSchema.parse(row);
    return {
      id: parsed.id,
      title: parsed.title,
      description: parsed.description,
      instructorId: parsed.instructor_id,
      createdAt: parsed.created_at,
      updatedAt: parsed.updated_at,
    };
  }
}
