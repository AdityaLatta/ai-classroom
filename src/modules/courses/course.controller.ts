import { Request, Response } from "express";
import { CourseService } from "./course.service";
import { AppResponse, Get, Post, Put, Delete } from "@/utils";
import { ListCoursesQuery } from "./course.schemas";
import {
  requireAuth,
  requireRole,
  validate,
  validateParams,
  validateQuery,
} from "@/middlewares";
import {
  createCourseSchema,
  updateCourseSchema,
  courseIdSchema,
  listCoursesQuerySchema,
} from "./course.schemas";
import { eventBus } from "@/infra/eventBus";

export class CourseController {
  constructor(private readonly service: CourseService) {}

  @Get("/", requireAuth, validateQuery(listCoursesQuerySchema))
  async listCourses(req: Request, res: Response) {
    const query = req.validated.query as ListCoursesQuery;

    const result = await this.service.listCourses({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      cursor: query.cursor,
      filters: {
        search: query.search,
        instructorId: query.instructorId,
        status: query.status,
        category: query.category,
        difficulty: query.difficulty,
      },
      userId: req.user!.id,
      userRole: req.user!.role,
    });

    AppResponse.paginated(res, result.data, result.meta);
  }

  @Post("/", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), validate(createCourseSchema))
  async createCourse(req: Request, res: Response) {
    const instructorId = req.user!.id;
    const course = await this.service.createCourse(instructorId, req.body);

    eventBus.emit("course:created", {
      userId: instructorId,
      courseId: course.id,
      title: course.title,
    });

    AppResponse.created(res, course);
  }

  @Get("/:id", requireAuth, validateParams(courseIdSchema))
  async getCourse(req: Request, res: Response) {
    const { id } = req.validated.params as { id: string };
    const course = await this.service.getCourseWithVisibility(
      id,
      req.user!.id,
      req.user!.role,
    );
    AppResponse.ok(res, course);
  }

  @Put("/:id", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), validateParams(courseIdSchema), validate(updateCourseSchema))
  async updateCourse(req: Request, res: Response) {
    const userId = req.user!.id;
    const { id } = req.validated.params as { id: string };
    const course = await this.service.updateCourse(id, userId, req.body, req.user!.role);

    eventBus.emit("course:updated", {
      userId,
      courseId: course.id,
      title: course.title,
    });

    AppResponse.ok(res, course);
  }

  @Delete("/:id", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), validateParams(courseIdSchema))
  async deleteCourse(req: Request, res: Response) {
    const userId = req.user!.id;
    const { id } = req.validated.params as { id: string };
    await this.service.deleteCourse(id, userId, req.user!.role);

    eventBus.emit("course:deleted", {
      userId,
      courseId: id,
    });

    AppResponse.message(res, "Course deleted successfully");
  }
}
