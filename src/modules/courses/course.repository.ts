import { z } from "zod";
import { getDb } from "@/infra";
import { CreateCourseDTO, UpdateCourseDTO, Course, ListCoursesOptions, ICourseRepository } from "./course.types";
import { PaginatedResult, escapeLikePattern } from "@/utils";

const courseRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  instructor_id: z.string(),
  status: z.string(),
  thumbnail_url: z.string().nullable(),
  category: z.string().nullable(),
  difficulty: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

const COURSE_COLUMNS =
  "id, title, description, instructor_id, status, thumbnail_url, category, difficulty, created_at, updated_at";
const MAX_LIMIT = 100;

export class CourseRepository implements ICourseRepository {
  async createCourse(
    instructorId: string,
    dto: CreateCourseDTO,
  ): Promise<Course> {
    const db = getDb();
    const result = await db.query(
      `INSERT INTO courses (title, description, instructor_id, status, thumbnail_url, category, difficulty)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COURSE_COLUMNS}`,
      [
        dto.title,
        dto.description,
        instructorId,
        dto.status ?? "DRAFT",
        dto.thumbnailUrl ?? null,
        dto.category ?? null,
        dto.difficulty ?? null,
      ],
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
    const { offset, cursor, filters, userId, userRole } = options;
    const limit = Math.min(options.limit, MAX_LIMIT);

    // Build WHERE conditions for the data query
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Visibility filtering based on role
    if (userRole === "STUDENT") {
      conditions.push(`status = 'PUBLISHED'`);
    } else if (userRole === "INSTRUCTOR" && userId) {
      conditions.push(
        `(status = 'PUBLISHED' OR instructor_id = $${paramIndex})`,
      );
      params.push(userId);
      paramIndex++;
    }
    // ADMIN sees all — no status filter

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

    if (filters?.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters?.category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(filters.category);
      paramIndex++;
    }

    if (filters?.difficulty) {
      conditions.push(`difficulty = $${paramIndex}`);
      params.push(filters.difficulty);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Build count query separately (excludes cursor filter for accurate total)
    const countConditions: string[] = [];
    const countParams: unknown[] = [];
    let countParamIndex = 1;

    // Same visibility filter for count
    if (userRole === "STUDENT") {
      countConditions.push(`status = 'PUBLISHED'`);
    } else if (userRole === "INSTRUCTOR" && userId) {
      countConditions.push(
        `(status = 'PUBLISHED' OR instructor_id = $${countParamIndex})`,
      );
      countParams.push(userId);
      countParamIndex++;
    }

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

    if (filters?.status) {
      countConditions.push(`status = $${countParamIndex}`);
      countParams.push(filters.status);
      countParamIndex++;
    }

    if (filters?.category) {
      countConditions.push(`category = $${countParamIndex}`);
      countParams.push(filters.category);
      countParamIndex++;
    }

    if (filters?.difficulty) {
      countConditions.push(`difficulty = $${countParamIndex}`);
      countParams.push(filters.difficulty);
      countParamIndex++;
    }

    const countWhere =
      countConditions.length > 0
        ? `WHERE ${countConditions.join(" AND ")}`
        : "";
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

    const nextCursor =
      hasMore && data.length > 0
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
    if (dto.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(dto.status);
    }
    if (dto.thumbnailUrl !== undefined) {
      updates.push(`thumbnail_url = $${paramIndex++}`);
      values.push(dto.thumbnailUrl);
    }
    if (dto.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(dto.category);
    }
    if (dto.difficulty !== undefined) {
      updates.push(`difficulty = $${paramIndex++}`);
      values.push(dto.difficulty);
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
    const result = await db.query(`DELETE FROM courses WHERE id = $1`, [
      courseId,
    ]);
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
      status: parsed.status as Course["status"],
      thumbnailUrl: parsed.thumbnail_url,
      category: parsed.category,
      difficulty: parsed.difficulty as Course["difficulty"],
      createdAt: parsed.created_at,
      updatedAt: parsed.updated_at,
    };
  }
}
