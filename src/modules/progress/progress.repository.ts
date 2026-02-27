import { z } from "zod";
import { getDb } from "@/infra";
import {
  LessonProgress,
  UpdateProgressDTO,
  CourseProgressSummary,
  IProgressRepository,
} from "./progress.types";

const progressRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  lesson_id: z.string(),
  status: z.string(),
  progress_percent: z.number(),
  completed_at: z.coerce.date().nullable(),
  last_accessed_at: z.coerce.date(),
});

export class ProgressRepository implements IProgressRepository {
  async upsertProgress(
    userId: string,
    lessonId: string,
    dto: UpdateProgressDTO,
  ): Promise<LessonProgress> {
    const db = getDb();
    const completedAt =
      dto.status === "COMPLETED" ? "NOW()" : "NULL";

    const result = await db.query(
      `INSERT INTO lesson_progress (user_id, lesson_id, status, progress_percent, completed_at, last_accessed_at)
       VALUES ($1, $2, $3, $4, ${completedAt}, NOW())
       ON CONFLICT (user_id, lesson_id)
       DO UPDATE SET
         status = $3,
         progress_percent = $4,
         completed_at = ${dto.status === "COMPLETED" ? "COALESCE(lesson_progress.completed_at, NOW())" : "NULL"},
         last_accessed_at = NOW()
       RETURNING id, user_id, lesson_id, status, progress_percent, completed_at, last_accessed_at`,
      [userId, lessonId, dto.status, dto.progressPercent],
    );

    return this.mapRow(result.rows[0]);
  }

  async findByUserAndLesson(
    userId: string,
    lessonId: string,
  ): Promise<LessonProgress | null> {
    const db = getDb();
    const result = await db.query(
      `SELECT id, user_id, lesson_id, status, progress_percent, completed_at, last_accessed_at
       FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2`,
      [userId, lessonId],
    );
    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async getCourseProgress(
    userId: string,
    courseId: string,
  ): Promise<CourseProgressSummary> {
    const db = getDb();
    const result = await db.query(
      `SELECT
        $2::uuid as course_id,
        COUNT(l.id) as total_lessons,
        COUNT(CASE WHEN lp.status = 'COMPLETED' THEN 1 END) as completed_lessons,
        COUNT(CASE WHEN lp.status = 'IN_PROGRESS' THEN 1 END) as in_progress_lessons,
        MAX(lp.last_accessed_at) as last_accessed_at
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
       WHERE m.course_id = $2`,
      [userId, courseId],
    );

    const row = result.rows[0];
    const totalLessons = parseInt(row.total_lessons, 10) || 0;
    const completedLessons = parseInt(row.completed_lessons, 10) || 0;
    const inProgressLessons = parseInt(row.in_progress_lessons, 10) || 0;

    return {
      courseId,
      totalLessons,
      completedLessons,
      inProgressLessons,
      progressPercent:
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0,
      lastAccessedAt: row.last_accessed_at
        ? new Date(row.last_accessed_at)
        : null,
    };
  }

  private mapRow(row: Record<string, unknown>): LessonProgress {
    const parsed = progressRowSchema.parse(row);
    return {
      id: parsed.id,
      userId: parsed.user_id,
      lessonId: parsed.lesson_id,
      status: parsed.status as LessonProgress["status"],
      progressPercent: parsed.progress_percent,
      completedAt: parsed.completed_at,
      lastAccessedAt: parsed.last_accessed_at,
    };
  }
}
