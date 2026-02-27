import {
  Lesson,
  CreateLessonDTO,
  UpdateLessonDTO,
  ReorderLessonItem,
  ILessonRepository,
} from "./lesson.types";
import { IModuleRepository } from "@/modules/modules/module.types";
import { ICourseRepository } from "@/modules/courses/course.types";
import { AppError, ErrorCode } from "@/utils";

export class LessonService {
  constructor(
    private readonly repo: ILessonRepository,
    private readonly moduleRepo: IModuleRepository,
    private readonly courseRepo: ICourseRepository,
  ) {}

  async createLesson(
    userId: string,
    userRole: string,
    courseId: string,
    moduleId: string,
    dto: CreateLessonDTO,
  ): Promise<Lesson> {
    await this.verifyModuleOwnership(courseId, moduleId, userId, userRole);
    const order = await this.repo.getNextOrder(moduleId);
    return this.repo.create(moduleId, dto, order);
  }

  async getLessons(moduleId: string): Promise<Lesson[]> {
    return this.repo.findByModuleId(moduleId);
  }

  async getLesson(lessonId: string): Promise<Lesson> {
    const lesson = await this.repo.findById(lessonId);
    if (!lesson) {
      throw new AppError(404, "Lesson not found", ErrorCode.LESSON_NOT_FOUND);
    }
    return lesson;
  }

  async updateLesson(
    userId: string,
    userRole: string,
    courseId: string,
    moduleId: string,
    lessonId: string,
    dto: UpdateLessonDTO,
  ): Promise<Lesson> {
    await this.verifyModuleOwnership(courseId, moduleId, userId, userRole);

    const lesson = await this.repo.findById(lessonId);
    if (!lesson || lesson.moduleId !== moduleId) {
      throw new AppError(404, "Lesson not found", ErrorCode.LESSON_NOT_FOUND);
    }

    const updated = await this.repo.update(lessonId, dto);
    if (!updated) {
      throw new AppError(404, "Lesson not found", ErrorCode.LESSON_NOT_FOUND);
    }
    return updated;
  }

  async deleteLesson(
    userId: string,
    userRole: string,
    courseId: string,
    moduleId: string,
    lessonId: string,
  ): Promise<void> {
    await this.verifyModuleOwnership(courseId, moduleId, userId, userRole);

    const lesson = await this.repo.findById(lessonId);
    if (!lesson || lesson.moduleId !== moduleId) {
      throw new AppError(404, "Lesson not found", ErrorCode.LESSON_NOT_FOUND);
    }

    await this.repo.delete(lessonId);
  }

  async reorderLessons(
    userId: string,
    userRole: string,
    courseId: string,
    moduleId: string,
    items: ReorderLessonItem[],
  ): Promise<Lesson[]> {
    await this.verifyModuleOwnership(courseId, moduleId, userId, userRole);
    return this.repo.reorder(moduleId, items);
  }

  private async verifyModuleOwnership(
    courseId: string,
    moduleId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) {
      throw new AppError(404, "Course not found", ErrorCode.COURSE_NOT_FOUND);
    }
    if (course.instructorId !== userId && userRole !== "ADMIN") {
      throw new AppError(
        403,
        "You do not have permission to modify this course",
        ErrorCode.LESSON_FORBIDDEN,
      );
    }

    const mod = await this.moduleRepo.findById(moduleId);
    if (!mod || mod.courseId !== courseId) {
      throw new AppError(404, "Module not found", ErrorCode.MODULE_NOT_FOUND);
    }
  }
}
