// src/modules/courses/course.service.ts
import { ICourseRepository, CreateCourseDTO, UpdateCourseDTO, Course, ListCoursesOptions } from "./course.types";
import { AppError, ErrorCode, PaginatedResult, Cache, invalidateCache } from "@/utils";

export class CourseService {
  constructor(private readonly repo: ICourseRepository) {}

  async createCourse(
    instructorId: string,
    dto: CreateCourseDTO,
  ): Promise<Course> {
    return this.repo.createCourse(instructorId, dto);
  }

  @Cache({ ttl: 30_000, key: (courseId: unknown) => `${courseId}` })
  async getCourse(courseId: string): Promise<Course> {
    const course = await this.repo.findById(courseId);
    if (!course) {
      throw new AppError(404, "Course not found", ErrorCode.COURSE_NOT_FOUND);
    }
    return course;
  }

  async listCourses(
    options: ListCoursesOptions,
  ): Promise<PaginatedResult<Course>> {
    return this.repo.findAll(options);
  }

  async updateCourse(
    courseId: string,
    userId: string,
    dto: UpdateCourseDTO,
  ): Promise<Course> {
    const course = await this.repo.findById(courseId);
    if (!course) {
      throw new AppError(404, "Course not found", ErrorCode.COURSE_NOT_FOUND);
    }
    if (course.instructorId !== userId) {
      throw new AppError(403, "You can only update your own courses", ErrorCode.COURSE_FORBIDDEN);
    }

    const updated = await this.repo.update(courseId, dto);
    if (!updated) {
      throw new AppError(404, "Course not found", ErrorCode.COURSE_NOT_FOUND);
    }
    invalidateCache("CourseService.getCourse:");
    return updated;
  }

  async deleteCourse(courseId: string, userId: string): Promise<void> {
    const course = await this.repo.findById(courseId);
    if (!course) {
      throw new AppError(404, "Course not found", ErrorCode.COURSE_NOT_FOUND);
    }
    if (course.instructorId !== userId) {
      throw new AppError(403, "You can only delete your own courses", ErrorCode.COURSE_FORBIDDEN);
    }

    await this.repo.delete(courseId);
    invalidateCache("CourseService.getCourse:");
  }
}
