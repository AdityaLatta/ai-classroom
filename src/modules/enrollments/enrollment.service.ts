import {
  Enrollment,
  EnrolledCourse,
  EnrolledStudent,
  ListEnrolledCoursesOptions,
  IEnrollmentRepository,
} from "./enrollment.types";
import { ICourseRepository } from "@/modules/courses/course.types";
import { AppError, ErrorCode, PaginatedResult } from "@/utils";

export class EnrollmentService {
  constructor(
    private readonly repo: IEnrollmentRepository,
    private readonly courseRepo: ICourseRepository,
  ) {}

  async enroll(userId: string, courseId: string): Promise<Enrollment> {
    // Verify course exists and is published
    const course = await this.courseRepo.findById(courseId);
    if (!course) {
      throw new AppError(404, "Course not found", ErrorCode.COURSE_NOT_FOUND);
    }
    if (course.status !== "PUBLISHED") {
      throw new AppError(
        400,
        "Can only enroll in published courses",
        ErrorCode.ENROLLMENT_COURSE_NOT_PUBLISHED,
      );
    }

    // Check if already actively enrolled
    const existing = await this.repo.findByUserAndCourse(userId, courseId);
    if (existing && existing.status === "ACTIVE") {
      throw new AppError(
        409,
        "Already enrolled in this course",
        ErrorCode.ENROLLMENT_ALREADY_EXISTS,
      );
    }

    return this.repo.enroll(userId, courseId);
  }

  async unenroll(userId: string, courseId: string): Promise<void> {
    const enrollment = await this.repo.findByUserAndCourse(userId, courseId);
    if (!enrollment || enrollment.status !== "ACTIVE") {
      throw new AppError(
        404,
        "No active enrollment found",
        ErrorCode.ENROLLMENT_NOT_FOUND,
      );
    }

    await this.repo.unenroll(userId, courseId);
  }

  async getMyCourses(
    userId: string,
    options: ListEnrolledCoursesOptions,
  ): Promise<PaginatedResult<EnrolledCourse>> {
    return this.repo.findUserCourses(userId, options);
  }

  async getCourseStudents(
    userId: string,
    userRole: string,
    courseId: string,
  ): Promise<EnrolledStudent[]> {
    // Verify requestor is course owner or ADMIN
    const course = await this.courseRepo.findById(courseId);
    if (!course) {
      throw new AppError(404, "Course not found", ErrorCode.COURSE_NOT_FOUND);
    }
    if (course.instructorId !== userId && userRole !== "ADMIN") {
      throw new AppError(
        403,
        "Only the course instructor can view students",
        ErrorCode.COURSE_FORBIDDEN,
      );
    }

    return this.repo.findCourseStudents(courseId);
  }

  async getEnrollmentStatus(
    userId: string,
    courseId: string,
  ): Promise<{ enrolled: boolean; status?: string }> {
    const enrollment = await this.repo.findByUserAndCourse(userId, courseId);
    if (!enrollment) {
      return { enrolled: false };
    }
    return { enrolled: enrollment.status === "ACTIVE", status: enrollment.status };
  }
}
