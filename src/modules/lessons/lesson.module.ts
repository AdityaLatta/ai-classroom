import { CourseRepository } from "@/modules/courses/course.repository";
import { ModuleRepository } from "@/modules/modules/module.repository";
import { LessonRepository } from "./lesson.repository";
import { LessonService } from "./lesson.service";
import { LessonController } from "./lesson.controller";
import { buildRouter, ModuleDefinition } from "@/utils";
import { registerLessonListeners } from "./lesson.listeners";

// --- Composition root for lessons module ---
const lessonRepository = new LessonRepository();
const moduleRepository = new ModuleRepository();
const courseRepository = new CourseRepository();
const lessonService = new LessonService(
  lessonRepository,
  moduleRepository,
  courseRepository,
);
const lessonController = new LessonController(lessonService);

export const lessonRouter = buildRouter(lessonController);

export const moduleDefinition: ModuleDefinition = {
  router: lessonRouter,
  prefix: "courses",
  listeners: registerLessonListeners,
};
