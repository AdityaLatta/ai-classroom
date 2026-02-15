// src/modules/courses/course.types.ts
import { PaginatedResult } from "../../utils/pagination";

export interface CreateCourseDTO {
  title: string;
  description: string;
}

export interface UpdateCourseDTO {
  title?: string;
  description?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListCoursesFilters {
  search?: string;
  instructorId?: string;
}

export interface ListCoursesOptions {
  limit: number;
  offset: number;
  cursor?: string;
  filters?: ListCoursesFilters;
}

export interface ICourseRepository {
  createCourse(instructorId: string, dto: CreateCourseDTO): Promise<Course>;
  findById(courseId: string): Promise<Course | null>;
  findAll(options: ListCoursesOptions): Promise<PaginatedResult<Course>>;
  update(courseId: string, dto: UpdateCourseDTO): Promise<Course | null>;
  delete(courseId: string): Promise<boolean>;
}
