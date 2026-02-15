// src/modules/courses/course.types.ts
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
