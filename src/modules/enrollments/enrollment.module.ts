import { CourseRepository } from "@/modules/courses/course.repository";
import { EnrollmentRepository } from "./enrollment.repository";
import { EnrollmentService } from "./enrollment.service";
import { EnrollmentController } from "./enrollment.controller";
import { buildRouter, ModuleDefinition } from "@/utils";
import { registerEnrollmentListeners } from "./enrollment.listeners";

// --- Composition root for enrollments module ---
const enrollmentRepository = new EnrollmentRepository();
const courseRepository = new CourseRepository();
const enrollmentService = new EnrollmentService(
  enrollmentRepository,
  courseRepository,
);
const enrollmentController = new EnrollmentController(enrollmentService);

export const enrollmentRouter = buildRouter(enrollmentController);

export const moduleDefinition: ModuleDefinition = {
  router: enrollmentRouter,
  listeners: registerEnrollmentListeners,
};
