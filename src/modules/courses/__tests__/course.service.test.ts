import { CourseService } from "@/modules/courses/course.service";
import { CourseRepository } from "@/modules/courses/course.repository";
import { AppError } from "@/utils/AppError";
import { Course, CreateCourseDTO } from "@/modules/courses/course.types";

// Mock the repository
jest.mock("@/modules/courses/course.repository");

describe("CourseService", () => {
  let service: CourseService;
  let mockRepo: jest.Mocked<CourseRepository>;

  const mockCourse: Course = {
    id: "course-123",
    title: "Test Course",
    description: "A test course description",
    instructorId: "instructor-456",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const createCourseDto: CreateCourseDTO = {
    title: "Test Course",
    description: "A test course description",
  };

  beforeEach(() => {
    mockRepo = new CourseRepository() as jest.Mocked<CourseRepository>;
    service = new CourseService(mockRepo);
  });

  describe("createCourse", () => {
    it("should create a course successfully", async () => {
      mockRepo.createCourse.mockResolvedValue(mockCourse);

      const result = await service.createCourse(
        "instructor-456",
        createCourseDto,
      );

      expect(result).toEqual(mockCourse);
      expect(mockRepo.createCourse).toHaveBeenCalledWith(
        "instructor-456",
        createCourseDto,
      );
    });

    it("should pass instructor ID correctly", async () => {
      mockRepo.createCourse.mockResolvedValue(mockCourse);

      await service.createCourse("different-instructor", createCourseDto);

      expect(mockRepo.createCourse).toHaveBeenCalledWith(
        "different-instructor",
        createCourseDto,
      );
    });

    it("should propagate repository errors", async () => {
      mockRepo.createCourse.mockRejectedValue(new Error("Database error"));

      await expect(
        service.createCourse("instructor-456", createCourseDto),
      ).rejects.toThrow("Database error");
    });
  });

  describe("getCourse", () => {
    it("should return course when found", async () => {
      mockRepo.findById.mockResolvedValue(mockCourse);

      const result = await service.getCourse("course-123");

      expect(result).toEqual(mockCourse);
      expect(mockRepo.findById).toHaveBeenCalledWith("course-123");
    });

    it("should throw AppError 404 when course not found", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.getCourse("non-existent")).rejects.toThrow(AppError);

      try {
        await service.getCourse("non-existent");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(404);
        expect((error as AppError).message).toBe("Course not found");
      }
    });

    it("should propagate repository errors", async () => {
      mockRepo.findById.mockRejectedValue(new Error("Database error"));

      await expect(service.getCourse("course-123")).rejects.toThrow(
        "Database error",
      );
    });
  });
});
