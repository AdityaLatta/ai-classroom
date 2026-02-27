import {
  LessonProgress,
  UpdateProgressDTO,
  CourseProgressSummary,
  IProgressRepository,
} from "./progress.types";
import { IEnrollmentRepository } from "@/modules/enrollments/enrollment.types";
import { AppError, ErrorCode } from "@/utils";
import { getDb } from "@/infra";

export class ProgressService {
  constructor(
    private readonly repo: IProgressRepository,
    private readonly enrollmentRepo: IEnrollmentRepository,
  ) {}

  async updateProgress(
    userId: string,
    lessonId: string,
    dto: UpdateProgressDTO,
  ): Promise<LessonProgress> {
    // Verify user is enrolled in the course that contains this lesson
    const courseId = await this.getCourseIdForLesson(lessonId);
    if (!courseId) {
      throw new AppError(404, "Lesson not found", ErrorCode.LESSON_NOT_FOUND);
    }

    const isEnrolled = await this.enrollmentRepo.isEnrolled(userId, courseId);
    if (!isEnrolled) {
      throw new AppError(
        403,
        "You must be enrolled in this course to track progress",
        ErrorCode.PROGRESS_NOT_ENROLLED,
      );
    }

    return this.repo.upsertProgress(userId, lessonId, dto);
  }

  async getCourseProgress(
    userId: string,
    courseId: string,
  ): Promise<CourseProgressSummary> {
    const isEnrolled = await this.enrollmentRepo.isEnrolled(userId, courseId);
    if (!isEnrolled) {
      throw new AppError(
        403,
        "You must be enrolled in this course to view progress",
        ErrorCode.PROGRESS_NOT_ENROLLED,
      );
    }

    return this.repo.getCourseProgress(userId, courseId);
  }

  private async getCourseIdForLesson(
    lessonId: string,
  ): Promise<string | null> {
    const db = getDb();
    const result = await db.query(
      `SELECT m.course_id
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
       WHERE l.id = $1`,
      [lessonId],
    );
    if (result.rowCount === 0) return null;
    return result.rows[0].course_id;
  }
}
