import { Router } from "express";
import { CourseController } from "./course.controller";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireRole } from "../../middlewares/requireRole";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../middlewares/validate";
import {
  createCourseSchema,
  updateCourseSchema,
  courseIdSchema,
  listCoursesQuerySchema,
} from "./course.schemas";

export function createCourseRouter(controller: CourseController): Router {
  const router = Router();

  router.get("/", requireAuth, validateQuery(listCoursesQuerySchema), controller.listCourses);
  router.post(
    "/",
    requireAuth,
    requireRole("INSTRUCTOR", "ADMIN"),
    validate(createCourseSchema),
    controller.createCourse,
  );
  router.get("/:id", requireAuth, validateParams(courseIdSchema), controller.getCourse);
  router.put(
    "/:id",
    requireAuth,
    requireRole("INSTRUCTOR", "ADMIN"),
    validateParams(courseIdSchema),
    validate(updateCourseSchema),
    controller.updateCourse,
  );
  router.delete(
    "/:id",
    requireAuth,
    requireRole("INSTRUCTOR", "ADMIN"),
    validateParams(courseIdSchema),
    controller.deleteCourse,
  );

  return router;
}
