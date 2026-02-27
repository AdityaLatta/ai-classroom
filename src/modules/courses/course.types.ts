// src/modules/courses/course.types.ts
import { PaginatedResult } from "@/utils";

export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type CourseDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface CreateCourseDTO {
  title: string;
  description: string;
  status?: CourseStatus;
  thumbnailUrl?: string;
  category?: string;
  difficulty?: CourseDifficulty;
}

export interface UpdateCourseDTO {
  title?: string;
  description?: string;
  status?: CourseStatus;
  thumbnailUrl?: string;
  category?: string;
  difficulty?: CourseDifficulty;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructorId: string;
  status: CourseStatus;
  thumbnailUrl: string | null;
  category: string | null;
  difficulty: CourseDifficulty | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListCoursesFilters {
  search?: string;
  instructorId?: string;
  status?: CourseStatus;
  category?: string;
  difficulty?: CourseDifficulty;
}

export interface ListCoursesOptions {
  limit: number;
  offset: number;
  cursor?: string;
  filters?: ListCoursesFilters;
  userId?: string;
  userRole?: string;
}

export interface ICourseRepository {
  createCourse(instructorId: string, dto: CreateCourseDTO): Promise<Course>;
  findById(courseId: string): Promise<Course | null>;
  findAll(options: ListCoursesOptions): Promise<PaginatedResult<Course>>;
  update(courseId: string, dto: UpdateCourseDTO): Promise<Course | null>;
  delete(courseId: string): Promise<boolean>;
}
