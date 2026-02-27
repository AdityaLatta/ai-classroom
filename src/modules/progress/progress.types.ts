export type ProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export interface LessonProgress {
  id: string;
  userId: string;
  lessonId: string;
  status: ProgressStatus;
  progressPercent: number;
  completedAt: Date | null;
  lastAccessedAt: Date;
}

export interface UpdateProgressDTO {
  status: ProgressStatus;
  progressPercent: number;
}

export interface CourseProgressSummary {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  progressPercent: number;
  lastAccessedAt: Date | null;
}

export interface IProgressRepository {
  upsertProgress(
    userId: string,
    lessonId: string,
    dto: UpdateProgressDTO,
  ): Promise<LessonProgress>;
  findByUserAndLesson(
    userId: string,
    lessonId: string,
  ): Promise<LessonProgress | null>;
  getCourseProgress(
    userId: string,
    courseId: string,
  ): Promise<CourseProgressSummary>;
}
