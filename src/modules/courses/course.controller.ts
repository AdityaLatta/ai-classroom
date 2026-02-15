import { Request, Response } from "express";
import { CourseService } from "./course.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ListCoursesQuery } from "./course.schemas";
import { audit } from "../../utils/audit";

export class CourseController {
  constructor(private readonly service: CourseService) {}

  listCourses = asyncHandler(async (req: Request, res: Response) => {
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

    res.json(result);
  });

  createCourse = asyncHandler(async (req: Request, res: Response) => {
    const instructorId = req.user!.id;
    const course = await this.service.createCourse(instructorId, req.body);

    audit({
      action: "COURSE_CREATED",
      userId: instructorId,
      metadata: { courseId: course.id, title: course.title },
    });

    res.status(201).json({ data: course });
  });

  getCourse = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validated.params as { id: string };
    const course = await this.service.getCourse(id);
    res.json({ data: course });
  });

  updateCourse = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.validated.params as { id: string };
    const course = await this.service.updateCourse(id, userId, req.body);

    audit({
      action: "COURSE_UPDATED",
      userId,
      metadata: { courseId: course.id, title: course.title },
    });

    res.json({ data: course });
  });

  deleteCourse = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.validated.params as { id: string };
    await this.service.deleteCourse(id, userId);

    audit({
      action: "COURSE_DELETED",
      userId,
      metadata: { courseId: id },
    });

    res.json({ message: "Course deleted successfully" });
  });
}
