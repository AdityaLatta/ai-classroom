import { Request, Response } from "express";
import { LessonService } from "./lesson.service";
import { AppResponse, Get, Post, Put, Delete } from "@/utils";
import {
  requireAuth,
  requireRole,
  validate,
  validateParams,
} from "@/middlewares";
import {
  lessonParamsSchema,
  lessonIdParamsSchema,
  createLessonSchema,
  updateLessonSchema,
  reorderLessonsSchema,
} from "./lesson.schemas";
import { eventBus } from "@/infra/eventBus";

export class LessonController {
  constructor(private readonly service: LessonService) {}

  @Get(
    "/:courseId/modules/:moduleId/lessons",
    requireAuth,
    validateParams(lessonParamsSchema),
  )
  async listLessons(req: Request, res: Response) {
    const { moduleId } = req.validated.params as {
      courseId: string;
      moduleId: string;
    };
    const lessons = await this.service.getLessons(moduleId);
    AppResponse.ok(res, lessons);
  }

  @Post(
    "/:courseId/modules/:moduleId/lessons",
    requireAuth,
    requireRole("INSTRUCTOR", "ADMIN"),
    validateParams(lessonParamsSchema),
    validate(createLessonSchema),
  )
  async createLesson(req: Request, res: Response) {
    const userId = req.user!.id;
    const { courseId, moduleId } = req.validated.params as {
      courseId: string;
      moduleId: string;
    };
    const lesson = await this.service.createLesson(
      userId,
      req.user!.role,
      courseId,
      moduleId,
      req.body,
    );

    eventBus.emit("lesson:created", {
      userId,
      moduleId,
      lessonId: lesson.id,
      title: lesson.title,
    });

    AppResponse.created(res, lesson);
  }

  @Put(
    "/:courseId/modules/:moduleId/lessons/reorder",
    requireAuth,
    requireRole("INSTRUCTOR", "ADMIN"),
    validateParams(lessonParamsSchema),
    validate(reorderLessonsSchema),
  )
  async reorderLessons(req: Request, res: Response) {
    const userId = req.user!.id;
    const { courseId, moduleId } = req.validated.params as {
      courseId: string;
      moduleId: string;
    };
    const lessons = await this.service.reorderLessons(
      userId,
      req.user!.role,
      courseId,
      moduleId,
      req.body.lessons,
    );

    AppResponse.ok(res, lessons);
  }

  @Put(
    "/:courseId/modules/:moduleId/lessons/:lessonId",
    requireAuth,
    requireRole("INSTRUCTOR", "ADMIN"),
    validateParams(lessonIdParamsSchema),
    validate(updateLessonSchema),
  )
  async updateLesson(req: Request, res: Response) {
    const userId = req.user!.id;
    const { courseId, moduleId, lessonId } = req.validated.params as {
      courseId: string;
      moduleId: string;
      lessonId: string;
    };
    const lesson = await this.service.updateLesson(
      userId,
      req.user!.role,
      courseId,
      moduleId,
      lessonId,
      req.body,
    );

    eventBus.emit("lesson:updated", {
      userId,
      moduleId,
      lessonId: lesson.id,
      title: lesson.title,
    });

    AppResponse.ok(res, lesson);
  }

  @Delete(
    "/:courseId/modules/:moduleId/lessons/:lessonId",
    requireAuth,
    requireRole("INSTRUCTOR", "ADMIN"),
    validateParams(lessonIdParamsSchema),
  )
  async deleteLesson(req: Request, res: Response) {
    const userId = req.user!.id;
    const { courseId, moduleId, lessonId } = req.validated.params as {
      courseId: string;
      moduleId: string;
      lessonId: string;
    };
    await this.service.deleteLesson(
      userId,
      req.user!.role,
      courseId,
      moduleId,
      lessonId,
    );

    eventBus.emit("lesson:deleted", { userId, moduleId, lessonId });

    AppResponse.message(res, "Lesson deleted successfully");
  }
}
