import { CourseRepository } from "@/modules/courses/course.repository";
import { ModuleRepository } from "./module.repository";
import { ModuleService } from "./module.service";
import { ModuleController } from "./module.controller";
import { buildRouter, ModuleDefinition } from "@/utils";
import { registerModuleListeners } from "./module.listeners";

// --- Composition root for modules module ---
const moduleRepository = new ModuleRepository();
const courseRepository = new CourseRepository();
const moduleService = new ModuleService(moduleRepository, courseRepository);
const moduleController = new ModuleController(moduleService);

export const moduleRouter = buildRouter(moduleController);

export const moduleDefinition: ModuleDefinition = {
  router: moduleRouter,
  prefix: "courses",
  listeners: registerModuleListeners,
};
