// src/modules/courses/course.routes.ts
import { Router } from "express";
import { CourseRepository } from "./course.repository";
import { CourseService } from "./course.service";
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

const router = Router();

const repo = new CourseRepository();
const service = new CourseService(repo);
const controller = new CourseController(service);

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

export { router as courseRouter };
