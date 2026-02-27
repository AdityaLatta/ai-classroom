import { Request, Response } from "express";
import { ProgressService } from "./progress.service";
import { AppResponse, Get, Put } from "@/utils";
import { requireAuth, validate, validateParams } from "@/middlewares";
import {
  lessonIdParamSchema,
  courseIdParamSchema,
  updateProgressSchema,
} from "./progress.schemas";
import { eventBus } from "@/infra/eventBus";

export class ProgressController {
  constructor(private readonly service: ProgressService) {}

  @Put(
    "/lessons/:lessonId",
    requireAuth,
    validateParams(lessonIdParamSchema),
    validate(updateProgressSchema),
  )
  async updateProgress(req: Request, res: Response) {
    const userId = req.user!.id;
    const { lessonId } = req.validated.params as { lessonId: string };
    const progress = await this.service.updateProgress(
      userId,
      lessonId,
      req.body,
    );

    eventBus.emit("progress:updated", {
      userId,
      lessonId,
      status: progress.status,
      progressPercent: progress.progressPercent,
    });

    AppResponse.ok(res, progress);
  }

  @Get(
    "/courses/:courseId",
    requireAuth,
    validateParams(courseIdParamSchema),
  )
  async getCourseProgress(req: Request, res: Response) {
    const userId = req.user!.id;
    const { courseId } = req.validated.params as { courseId: string };
    const progress = await this.service.getCourseProgress(userId, courseId);
    AppResponse.ok(res, progress);
  }
}
