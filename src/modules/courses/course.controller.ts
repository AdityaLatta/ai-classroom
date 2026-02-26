import { Request, Response } from "express";
import { CourseService } from "./course.service";
import { AppResponse, audit, Get, Post, Put, Delete } from "@/utils";
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
      },
    });

    AppResponse.paginated(res, result.data, result.meta);
  }

  @Post("/", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), validate(createCourseSchema))
  async createCourse(req: Request, res: Response) {
    const instructorId = req.user!.id;
    const course = await this.service.createCourse(instructorId, req.body);

    audit({
      action: "COURSE_CREATED",
      userId: instructorId,
      metadata: { courseId: course.id, title: course.title },
    });

    AppResponse.created(res, course);
  }

  @Get("/:id", requireAuth, validateParams(courseIdSchema))
  async getCourse(req: Request, res: Response) {
    const { id } = req.validated.params as { id: string };
    const course = await this.service.getCourse(id);
    AppResponse.ok(res, course);
  }

  @Put("/:id", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), validateParams(courseIdSchema), validate(updateCourseSchema))
  async updateCourse(req: Request, res: Response) {
    const userId = req.user!.id;
    const { id } = req.validated.params as { id: string };
    const course = await this.service.updateCourse(id, userId, req.body);

    audit({
      action: "COURSE_UPDATED",
      userId,
      metadata: { courseId: course.id, title: course.title },
    });

    AppResponse.ok(res, course);
  }

  @Delete("/:id", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), validateParams(courseIdSchema))
  async deleteCourse(req: Request, res: Response) {
    const userId = req.user!.id;
    const { id } = req.validated.params as { id: string };
    await this.service.deleteCourse(id, userId);

    audit({
      action: "COURSE_DELETED",
      userId,
      metadata: { courseId: id },
    });

    AppResponse.message(res, "Course deleted successfully");
  }
}
