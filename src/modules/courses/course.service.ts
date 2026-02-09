// src/modules/courses/course.service.ts
import { ICourseRepository } from "./course.repository";
import { CreateCourseDTO, Course, ListCoursesOptions } from "./course.types";
import { AppError } from "../../utils/AppError";
import { PaginatedResult } from "../../utils/pagination";

export class CourseService {
  constructor(private readonly repo: ICourseRepository) {}

  async createCourse(
    instructorId: string,
    dto: CreateCourseDTO,
  ): Promise<Course> {
    return this.repo.createCourse(instructorId, dto);
  }

  async getCourse(courseId: string): Promise<Course> {
    const course = await this.repo.findById(courseId);
    if (!course) {
      throw new AppError(404, "Course not found", "COURSE_NOT_FOUND");
    }
    return course;
  }

  async listCourses(
    options: ListCoursesOptions,
  ): Promise<PaginatedResult<Course>> {
    return this.repo.findAll(options);
  }
}
