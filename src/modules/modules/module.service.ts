import {
  CourseModule,
  CreateModuleDTO,
  UpdateModuleDTO,
  ReorderModuleItem,
  IModuleRepository,
} from "./module.types";
import { ICourseRepository } from "@/modules/courses/course.types";
import { AppError, ErrorCode } from "@/utils";

export class ModuleService {
  constructor(
    private readonly repo: IModuleRepository,
    private readonly courseRepo: ICourseRepository,
  ) {}

  async createModule(
    userId: string,
    userRole: string,
    courseId: string,
    dto: CreateModuleDTO,
  ): Promise<CourseModule> {
    await this.verifyCourseOwnership(courseId, userId, userRole);
    const order = await this.repo.getNextOrder(courseId);
    return this.repo.create(courseId, dto, order);
  }

  async getModules(courseId: string): Promise<CourseModule[]> {
    return this.repo.findByCourseId(courseId);
  }

  async getModule(moduleId: string): Promise<CourseModule> {
    const mod = await this.repo.findById(moduleId);
    if (!mod) {
      throw new AppError(404, "Module not found", ErrorCode.MODULE_NOT_FOUND);
    }
    return mod;
  }

  async updateModule(
    userId: string,
    userRole: string,
    courseId: string,
    moduleId: string,
    dto: UpdateModuleDTO,
  ): Promise<CourseModule> {
    await this.verifyCourseOwnership(courseId, userId, userRole);

    const mod = await this.repo.findById(moduleId);
    if (!mod || mod.courseId !== courseId) {
      throw new AppError(404, "Module not found", ErrorCode.MODULE_NOT_FOUND);
    }

    const updated = await this.repo.update(moduleId, dto);
    if (!updated) {
      throw new AppError(404, "Module not found", ErrorCode.MODULE_NOT_FOUND);
    }
    return updated;
  }

  async deleteModule(
    userId: string,
    userRole: string,
    courseId: string,
    moduleId: string,
  ): Promise<void> {
    await this.verifyCourseOwnership(courseId, userId, userRole);

    const mod = await this.repo.findById(moduleId);
    if (!mod || mod.courseId !== courseId) {
      throw new AppError(404, "Module not found", ErrorCode.MODULE_NOT_FOUND);
    }

    await this.repo.delete(moduleId);
  }

  async reorderModules(
    userId: string,
    userRole: string,
    courseId: string,
    items: ReorderModuleItem[],
  ): Promise<CourseModule[]> {
    await this.verifyCourseOwnership(courseId, userId, userRole);
    return this.repo.reorder(courseId, items);
  }

  private async verifyCourseOwnership(
    courseId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) {
      throw new AppError(404, "Course not found", ErrorCode.COURSE_NOT_FOUND);
    }
    if (course.instructorId !== userId && userRole !== "ADMIN") {
      throw new AppError(
        403,
        "You do not have permission to modify this course",
        ErrorCode.MODULE_FORBIDDEN,
      );
    }
  }
}
