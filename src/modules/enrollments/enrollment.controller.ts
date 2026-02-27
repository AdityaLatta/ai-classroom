import { Request, Response } from "express";
import { EnrollmentService } from "./enrollment.service";
import { AppResponse, Get, Post, Delete } from "@/utils";
import {
  requireAuth,
  requireRole,
  validateParams,
  validateQuery,
} from "@/middlewares";
import {
  enrollCourseParamSchema,
  myCoursesQuerySchema,
  MyCoursesQuery,
} from "./enrollment.schemas";
import { eventBus } from "@/infra/eventBus";

export class EnrollmentController {
  constructor(private readonly service: EnrollmentService) {}

  @Post(
    "/courses/:courseId/enroll",
    requireAuth,
    requireRole("STUDENT"),
    validateParams(enrollCourseParamSchema),
  )
  async enroll(req: Request, res: Response) {
    const userId = req.user!.id;
    const { courseId } = req.validated.params as { courseId: string };
    const enrollment = await this.service.enroll(userId, courseId);

    eventBus.emit("enrollment:created", {
      userId,
      courseId,
      enrollmentId: enrollment.id,
    });

    AppResponse.created(res, enrollment);
  }

  @Delete(
    "/courses/:courseId/unenroll",
    requireAuth,
    requireRole("STUDENT"),
    validateParams(enrollCourseParamSchema),
  )
  async unenroll(req: Request, res: Response) {
    const userId = req.user!.id;
    const { courseId } = req.validated.params as { courseId: string };
    await this.service.unenroll(userId, courseId);

    eventBus.emit("enrollment:dropped", { userId, courseId });

    AppResponse.message(res, "Successfully unenrolled from course");
  }

  @Get("/my-courses", requireAuth, validateQuery(myCoursesQuerySchema))
  async getMyCourses(req: Request, res: Response) {
    const userId = req.user!.id;
    const query = req.validated.query as MyCoursesQuery;

    const result = await this.service.getMyCourses(userId, {
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status,
    });

    AppResponse.paginated(res, result.data, result.meta);
  }

  @Get(
    "/courses/:courseId/students",
    requireAuth,
    requireRole("INSTRUCTOR", "ADMIN"),
    validateParams(enrollCourseParamSchema),
  )
  async getCourseStudents(req: Request, res: Response) {
    const userId = req.user!.id;
    const { courseId } = req.validated.params as { courseId: string };
    const students = await this.service.getCourseStudents(
      userId,
      req.user!.role,
      courseId,
    );
    AppResponse.ok(res, students);
  }

  @Get(
    "/courses/:courseId/status",
    requireAuth,
    validateParams(enrollCourseParamSchema),
  )
  async getEnrollmentStatus(req: Request, res: Response) {
    const userId = req.user!.id;
    const { courseId } = req.validated.params as { courseId: string };
    const status = await this.service.getEnrollmentStatus(userId, courseId);
    AppResponse.ok(res, status);
  }
}
