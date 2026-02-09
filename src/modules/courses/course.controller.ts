// src/modules/courses/course.controller.ts
import { Request, Response } from "express";
import { CourseService } from "./course.service";
import { asyncHandler } from "../../utils/asyncHandler";

export class CourseController {
  constructor(private readonly service: CourseService) {}

  listCourses = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.listCourses({
      limit: Number(req.query.limit) || 20,
      offset: Number(req.query.offset) || 0,
      filters: {
        search: req.query.search as string | undefined,
        instructorId: req.query.instructorId as string | undefined,
      },
    });

    res.json(result);
  });

  createCourse = asyncHandler(async (req: Request, res: Response) => {
    const instructorId = req.user!.id;
    const course = await this.service.createCourse(instructorId, req.body);
    res.status(201).json(course);
  });

  getCourse = asyncHandler(async (req: Request, res: Response) => {
    const course = await this.service.getCourse(req.params.id as string);
    res.json(course);
  });
}
