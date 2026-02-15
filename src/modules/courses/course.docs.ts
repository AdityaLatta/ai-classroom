import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  createCourseSchema,
  updateCourseSchema,
  courseIdSchema,
  listCoursesQuerySchema,
} from "./course.schemas";

export const courseRegistry = new OpenAPIRegistry();

const courseRef = { $ref: "#/components/schemas/Course" };
const paginationMetaRef = { $ref: "#/components/schemas/PaginationMeta" };
const validationErrorRef = { $ref: "#/components/schemas/ValidationError" };

courseRegistry.registerPath({
  method: "get",
  path: "/courses",
  tags: ["Courses"],
  summary: "List all courses",
  description: "Returns a paginated list of courses",
  security: [{ BearerAuth: [] }],
  request: {
    query: listCoursesQuerySchema,
  },
  responses: {
    200: {
      description: "Paginated list of courses",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              data: { type: "array", items: courseRef },
              meta: paginationMetaRef,
            },
          } as any,
        },
      },
    },
    401: { description: "Unauthorized" },
  },
});

courseRegistry.registerPath({
  method: "post",
  path: "/courses",
  tags: ["Courses"],
  summary: "Create a new course",
  description: "Create a new course (instructors and admins only)",
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: createCourseSchema } }, required: true },
  },
  responses: {
    201: { description: "Course created successfully", content: { "application/json": { schema: courseRef as any } } },
    400: { description: "Validation error", content: { "application/json": { schema: validationErrorRef as any } } },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden — only instructors and admins can create courses" },
  },
});

courseRegistry.registerPath({
  method: "get",
  path: "/courses/{id}",
  tags: ["Courses"],
  summary: "Get course by ID",
  description: "Returns a single course by its ID",
  security: [{ BearerAuth: [] }],
  request: {
    params: courseIdSchema,
  },
  responses: {
    200: { description: "Course details", content: { "application/json": { schema: courseRef as any } } },
    401: { description: "Unauthorized" },
    404: { description: "Course not found" },
  },
});

courseRegistry.registerPath({
  method: "put",
  path: "/courses/{id}",
  tags: ["Courses"],
  summary: "Update a course",
  description: "Update a course (owner only)",
  security: [{ BearerAuth: [] }],
  request: {
    params: courseIdSchema,
    body: { content: { "application/json": { schema: updateCourseSchema } }, required: true },
  },
  responses: {
    200: { description: "Course updated successfully", content: { "application/json": { schema: courseRef as any } } },
    400: { description: "Validation error", content: { "application/json": { schema: validationErrorRef as any } } },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden — only the course owner can update" },
    404: { description: "Course not found" },
  },
});

courseRegistry.registerPath({
  method: "delete",
  path: "/courses/{id}",
  tags: ["Courses"],
  summary: "Delete a course",
  description: "Delete a course (owner only)",
  security: [{ BearerAuth: [] }],
  request: {
    params: courseIdSchema,
  },
  responses: {
    200: { description: "Course deleted successfully" },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden — only the course owner can delete" },
    404: { description: "Course not found" },
  },
});
