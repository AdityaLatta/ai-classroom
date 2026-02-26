import { CourseRepository } from "./course.repository";
import { CourseService } from "./course.service";
import { CourseController } from "./course.controller";
import { buildRouter, ModuleDefinition } from "@/utils";
import { registerCourseListeners } from "./course.listeners";

// --- Composition root for course module ---
const courseRepository = new CourseRepository();
const courseService = new CourseService(courseRepository);
const courseController = new CourseController(courseService);

export const courseRouter = buildRouter(courseController);

export const moduleDefinition: ModuleDefinition = {
  router: courseRouter,
  listeners: registerCourseListeners,
};
