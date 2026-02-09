// src/modules/courses/course.repository.ts
import { getDb } from "../../infra/db";
import { CreateCourseDTO, Course, ListCoursesOptions } from "./course.types";
import { PaginatedResult } from "../../utils/pagination";

export interface ICourseRepository {
  createCourse(instructorId: string, dto: CreateCourseDTO): Promise<Course>;
  findById(courseId: string): Promise<Course | null>;
  findAll(options: ListCoursesOptions): Promise<PaginatedResult<Course>>;
}

export class CourseRepository implements ICourseRepository {
  async createCourse(
    instructorId: string,
    dto: CreateCourseDTO,
  ): Promise<Course> {
    const db = getDb();
    const query = `
      INSERT INTO courses (title, description, instructor_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await db.query(query, [
      dto.title,
      dto.description,
      instructorId,
    ]);

    return this.mapRow(result.rows[0]);
  }

  async findById(courseId: string): Promise<Course | null> {
    const db = getDb();
    const result = await db.query(`SELECT * FROM courses WHERE id = $1`, [
      courseId,
    ]);

    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async findAll(options: ListCoursesOptions): Promise<PaginatedResult<Course>> {
    const db = getDb();
    const { limit, offset, filters } = options;

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.search) {
      conditions.push(
        `(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`,
      );
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters?.instructorId) {
      conditions.push(`instructor_id = $${paramIndex}`);
      params.push(filters.instructorId);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM courses ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results (LIMIT/OFFSET at DB level)
    const dataParams = [...params, limit, offset];
    const result = await db.query(
      `SELECT * FROM courses ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams,
    );

    return {
      data: result.rows.map((row) => this.mapRow(row)),
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  private mapRow(row: Record<string, unknown>): Course {
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      instructorId: row.instructor_id as string,
      createdAt: row.created_at as Date,
    };
  }
}
