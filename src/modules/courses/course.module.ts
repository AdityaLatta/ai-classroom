import { CourseRepository } from "./course.repository";
import { CourseService } from "./course.service";
import { CourseController } from "./course.controller";
import { createCourseRouter } from "./course.routes";

// --- Composition root for course module ---
const courseRepository = new CourseRepository();
const courseService = new CourseService(courseRepository);
const courseController = new CourseController(courseService);

export const courseRouter = createCourseRouter(courseController);
