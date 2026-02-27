import { Request, Response } from "express";
import { ModuleService } from "./module.service";
import { AppResponse, Get, Post, Put, Delete } from "@/utils";
import {
  requireAuth,
  requireRole,
  validate,
  validateParams,
} from "@/middlewares";
import {
  courseIdParamSchema,
  moduleIdParamSchema,
  createModuleSchema,
  updateModuleSchema,
  reorderModulesSchema,
} from "./module.schemas";
import { eventBus } from "@/infra/eventBus";

export class ModuleController {
  constructor(private readonly service: ModuleService) {}

  @Get("/:courseId/modules", requireAuth, validateParams(courseIdParamSchema))
  async listModules(req: Request, res: Response) {
    const { courseId } = req.validated.params as { courseId: string };
    const modules = await this.service.getModules(courseId);
    AppResponse.ok(res, modules);
  }

  @Post(
    "/:courseId/modules",
    requireAuth,
    requireRole("INSTRUCTOR", "ADMIN"),
    validateParams(courseIdParamSchema),
    validate(createModuleSchema),
  )
  async createModule(req: Request, res: Response) {
    const userId = req.user!.id;
    const { courseId } = req.validated.params as { courseId: string };
    const mod = await this.service.createModule(
      userId,
      req.user!.role,
      courseId,
      req.body,
    );

    eventBus.emit("module:created", {
      userId,
      courseId,
      moduleId: mod.id,
      title: mod.title,
    });

    AppResponse.created(res, mod);
  }

  @Put(
    "/:courseId/modules/reorder",
    requireAuth,
    requireRole("INSTRUCTOR", "ADMIN"),
    validateParams(courseIdParamSchema),
    validate(reorderModulesSchema),
  )
  async reorderModules(req: Request, res: Response) {
    const userId = req.user!.id;
    const { courseId } = req.validated.params as { courseId: string };
    const modules = await this.service.reorderModules(
      userId,
      req.user!.role,
      courseId,
      req.body.modules,
    );

    eventBus.emit("module:reordered", { userId, courseId });

    AppResponse.ok(res, modules);
  }

  @Put(
    "/:courseId/modules/:moduleId",
    requireAuth,
    requireRole("INSTRUCTOR", "ADMIN"),
    validateParams(moduleIdParamSchema),
    validate(updateModuleSchema),
  )
  async updateModule(req: Request, res: Response) {
    const userId = req.user!.id;
    const { courseId, moduleId } = req.validated.params as {
      courseId: string;
      moduleId: string;
    };
    const mod = await this.service.updateModule(
      userId,
      req.user!.role,
      courseId,
      moduleId,
      req.body,
    );

    eventBus.emit("module:updated", {
      userId,
      courseId,
      moduleId: mod.id,
      title: mod.title,
    });

    AppResponse.ok(res, mod);
  }

  @Delete(
    "/:courseId/modules/:moduleId",
    requireAuth,
    requireRole("INSTRUCTOR", "ADMIN"),
    validateParams(moduleIdParamSchema),
  )
  async deleteModule(req: Request, res: Response) {
    const userId = req.user!.id;
    const { courseId, moduleId } = req.validated.params as {
      courseId: string;
      moduleId: string;
    };
    await this.service.deleteModule(userId, req.user!.role, courseId, moduleId);

    eventBus.emit("module:deleted", { userId, courseId, moduleId });

    AppResponse.message(res, "Module deleted successfully");
  }
}
