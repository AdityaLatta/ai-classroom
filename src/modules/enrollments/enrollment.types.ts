import { Course } from "@/modules/courses/course.types";
import { PaginatedResult } from "@/utils";

export type EnrollmentStatus = "ACTIVE" | "DROPPED";

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
}

export interface EnrolledCourse extends Course {
  enrollmentId: string;
  enrollmentStatus: EnrollmentStatus;
  enrolledAt: Date;
  progress: CourseProgress;
}

export interface CourseProgress {
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
}

export interface EnrolledStudent {
  userId: string;
  userName: string;
  userEmail: string;
  enrollmentId: string;
  enrolledAt: Date;
  status: EnrollmentStatus;
}

export interface ListEnrolledCoursesOptions {
  limit: number;
  offset: number;
  status?: EnrollmentStatus;
}

export interface IEnrollmentRepository {
  enroll(userId: string, courseId: string): Promise<Enrollment>;
  unenroll(userId: string, courseId: string): Promise<boolean>;
  findByUserAndCourse(userId: string, courseId: string): Promise<Enrollment | null>;
  findUserCourses(userId: string, options: ListEnrolledCoursesOptions): Promise<PaginatedResult<EnrolledCourse>>;
  findCourseStudents(courseId: string): Promise<EnrolledStudent[]>;
  getEnrollmentCount(courseId: string): Promise<number>;
  isEnrolled(userId: string, courseId: string): Promise<boolean>;
}
