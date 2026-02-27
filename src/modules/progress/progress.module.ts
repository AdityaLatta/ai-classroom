import { EnrollmentRepository } from "@/modules/enrollments/enrollment.repository";
import { ProgressRepository } from "./progress.repository";
import { ProgressService } from "./progress.service";
import { ProgressController } from "./progress.controller";
import { buildRouter, ModuleDefinition } from "@/utils";
import { registerProgressListeners } from "./progress.listeners";

// --- Composition root for progress module ---
const progressRepository = new ProgressRepository();
const enrollmentRepository = new EnrollmentRepository();
const progressService = new ProgressService(
  progressRepository,
  enrollmentRepository,
);
const progressController = new ProgressController(progressService);

export const progressRouter = buildRouter(progressController);

export const moduleDefinition: ModuleDefinition = {
  router: progressRouter,
  listeners: registerProgressListeners,
};
