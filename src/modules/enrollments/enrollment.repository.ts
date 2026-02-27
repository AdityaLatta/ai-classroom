import { z } from "zod";
import { getDb } from "@/infra";
import {
  Enrollment,
  EnrolledCourse,
  EnrolledStudent,
  CourseProgress,
  ListEnrolledCoursesOptions,
  IEnrollmentRepository,
} from "./enrollment.types";
import { PaginatedResult } from "@/utils";

const enrollmentRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  course_id: z.string(),
  status: z.string(),
  enrolled_at: z.coerce.date(),
});

export class EnrollmentRepository implements IEnrollmentRepository {
  async enroll(userId: string, courseId: string): Promise<Enrollment> {
    const db = getDb();
    // Upsert: re-activate if previously DROPPED
    const result = await db.query(
      `INSERT INTO enrollments (user_id, course_id, status, enrolled_at)
       VALUES ($1, $2, 'ACTIVE', NOW())
       ON CONFLICT (user_id, course_id)
       DO UPDATE SET status = 'ACTIVE', enrolled_at = NOW()
       RETURNING id, user_id, course_id, status, enrolled_at`,
      [userId, courseId],
    );
    return this.mapEnrollmentRow(result.rows[0]);
  }

  async unenroll(userId: string, courseId: string): Promise<boolean> {
    const db = getDb();
    const result = await db.query(
      `UPDATE enrollments SET status = 'DROPPED'
       WHERE user_id = $1 AND course_id = $2 AND status = 'ACTIVE'`,
      [userId, courseId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findByUserAndCourse(
    userId: string,
    courseId: string,
  ): Promise<Enrollment | null> {
    const db = getDb();
    const result = await db.query(
      `SELECT id, user_id, course_id, status, enrolled_at
       FROM enrollments WHERE user_id = $1 AND course_id = $2`,
      [userId, courseId],
    );
    if (result.rowCount === 0) return null;
    return this.mapEnrollmentRow(result.rows[0]);
  }

  async findUserCourses(
    userId: string,
    options: ListEnrolledCoursesOptions,
  ): Promise<PaginatedResult<EnrolledCourse>> {
    const db = getDb();
    const { offset } = options;
    const limit = Math.min(options.limit, 100);

    const conditions: string[] = ["e.user_id = $1"];
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (options.status) {
      conditions.push(`e.status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // Count
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM enrollments e ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Data with course info and progress aggregation
    const dataParams = [...params, limit, offset];
    const result = await db.query(
      `SELECT
        c.id, c.title, c.description, c.instructor_id,
        c.status, c.thumbnail_url, c.category, c.difficulty,
        c.created_at, c.updated_at,
        e.id as enrollment_id, e.status as enrollment_status, e.enrolled_at,
        COALESCE(lp.total_lessons, 0) as total_lessons,
        COALESCE(lp.completed_lessons, 0) as completed_lessons
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN LATERAL (
         SELECT
           COUNT(l.id) as total_lessons,
           COUNT(CASE WHEN p.status = 'COMPLETED' THEN 1 END) as completed_lessons
         FROM lessons l
         JOIN modules m ON m.id = l.module_id AND m.course_id = c.id
         LEFT JOIN lesson_progress p ON p.lesson_id = l.id AND p.user_id = e.user_id
       ) lp ON true
       ${whereClause}
       ORDER BY e.enrolled_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams,
    );

    const data = result.rows.map((row) => this.mapEnrolledCourseRow(row));

    return {
      data,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async findCourseStudents(courseId: string): Promise<EnrolledStudent[]> {
    const db = getDb();
    const result = await db.query(
      `SELECT
        u.id as user_id, u.name as user_name, u.email as user_email,
        e.id as enrollment_id, e.enrolled_at, e.status
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       WHERE e.course_id = $1
       ORDER BY e.enrolled_at DESC`,
      [courseId],
    );

    return result.rows.map((row) => ({
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      enrollmentId: row.enrollment_id,
      enrolledAt: new Date(row.enrolled_at),
      status: row.status,
    }));
  }

  async getEnrollmentCount(courseId: string): Promise<number> {
    const db = getDb();
    const result = await db.query(
      `SELECT COUNT(*) as count FROM enrollments WHERE course_id = $1 AND status = 'ACTIVE'`,
      [courseId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  async isEnrolled(userId: string, courseId: string): Promise<boolean> {
    const db = getDb();
    const result = await db.query(
      `SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2 AND status = 'ACTIVE'`,
      [userId, courseId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapEnrollmentRow(row: Record<string, unknown>): Enrollment {
    const parsed = enrollmentRowSchema.parse(row);
    return {
      id: parsed.id,
      userId: parsed.user_id,
      courseId: parsed.course_id,
      status: parsed.status as Enrollment["status"],
      enrolledAt: parsed.enrolled_at,
    };
  }

  private mapEnrolledCourseRow(row: Record<string, unknown>): EnrolledCourse {
    const r = row as Record<string, string | number | null>;
    const totalLessons = Number(r.total_lessons) || 0;
    const completedLessons = Number(r.completed_lessons) || 0;
    const progress: CourseProgress = {
      totalLessons,
      completedLessons,
      progressPercent:
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0,
    };

    return {
      id: r.id as string,
      title: r.title as string,
      description: r.description as string,
      instructorId: r.instructor_id as string,
      status: r.status as EnrolledCourse["status"],
      thumbnailUrl: (r.thumbnail_url as string) || null,
      category: (r.category as string) || null,
      difficulty: (r.difficulty as EnrolledCourse["difficulty"]) || null,
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
      enrollmentId: r.enrollment_id as string,
      enrollmentStatus: r.enrollment_status as EnrolledCourse["enrollmentStatus"],
      enrolledAt: new Date(r.enrolled_at as string),
      progress,
    };
  }
}
