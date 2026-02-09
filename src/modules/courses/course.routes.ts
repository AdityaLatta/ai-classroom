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
  courseIdSchema,
  listCoursesQuerySchema,
} from "./course.schemas";

const router = Router();

const repo = new CourseRepository();
const service = new CourseService(repo);
const controller = new CourseController(service);

/**
 * @openapi
 * /courses:
 *   get:
 *     tags: [Courses]
 *     summary: List all courses
 *     description: Returns a paginated list of courses
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of items to skip
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for title/description
 *       - in: query
 *         name: instructorId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by instructor ID
 *     responses:
 *       200:
 *         description: Paginated list of courses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Course'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  requireAuth,
  validateQuery(listCoursesQuerySchema),
  controller.listCourses,
);

/**
 * @openapi
 * /courses:
 *   post:
 *     tags: [Courses]
 *     summary: Create a new course
 *     description: Create a new course (instructors and admins only)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description]
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *                 description: Course title
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 5000
 *                 description: Course description
 *     responses:
 *       201:
 *         description: Course created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Course'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — only instructors and admins can create courses
 */
router.post(
  "/",
  requireAuth,
  requireRole("INSTRUCTOR", "ADMIN"),
  validate(createCourseSchema),
  controller.createCourse,
);

/**
 * @openapi
 * /courses/{id}:
 *   get:
 *     tags: [Courses]
 *     summary: Get course by ID
 *     description: Returns a single course by its ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Course details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Course'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Course not found
 */
router.get(
  "/:id",
  requireAuth,
  validateParams(courseIdSchema),
  controller.getCourse,
);

export { router as courseRouter };
