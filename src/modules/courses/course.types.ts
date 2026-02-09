// src/modules/courses/course.types.ts
export interface CreateCourseDTO {
  title: string;
  description: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructorId: string;
  createdAt: Date;
}

export interface ListCoursesFilters {
  search?: string;
  instructorId?: string;
}

export interface ListCoursesOptions {
  limit: number;
  offset: number;
  filters?: ListCoursesFilters;
}
