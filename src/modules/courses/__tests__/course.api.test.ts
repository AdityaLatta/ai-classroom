import request from "supertest";
import { createApp } from "../../../app";
import { signAccessToken, JwtPayload } from "../../../auth/jwt";
import { Express } from "express";

// Create mock query function
const mockQuery = jest.fn();

// Mock the database
jest.mock("../../../infra/db", () => ({
  getDb: jest.fn(() => ({
    query: mockQuery,
  })),
  initDb: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue(true),
}));

describe("Course API", () => {
  let app: Express;
  let authToken: string;

  const userPayload: JwtPayload = {
    sub: "user-123",
    role: "INSTRUCTOR",
    email: "instructor@example.com",
  };

  beforeAll(() => {
    app = createApp();
    authToken = signAccessToken(userPayload);
  });

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe("POST /api/courses", () => {
    const validCourseData = {
      title: "Introduction to Testing",
      description: "Learn how to write effective tests for your applications",
    };

    const mockCourseRow = {
      id: "course-123",
      title: validCourseData.title,
      description: validCourseData.description,
      instructor_id: userPayload.sub,
      created_at: new Date("2024-01-01"),
    };

    it("should create a course with valid data", async () => {
      mockQuery.mockResolvedValue({
        rows: [mockCourseRow],
        rowCount: 1,
      });

      const response = await request(app)
        .post("/api/courses")
        .set("Authorization", `Bearer ${authToken}`)
        .send(validCourseData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: "course-123",
        title: validCourseData.title,
        description: validCourseData.description,
        instructorId: userPayload.sub,
      });
    });

    it("should return 401 without auth token", async () => {
      const response = await request(app)
        .post("/api/courses")
        .send(validCourseData);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
    });

    it("should return 401 with invalid auth token", async () => {
      const response = await request(app)
        .post("/api/courses")
        .set("Authorization", "Bearer invalid-token")
        .send(validCourseData);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Invalid or expired token" });
    });

    it("should return 400 for missing title", async () => {
      const response = await request(app)
        .post("/api/courses")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ description: "Valid description here" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should return 400 for title too short", async () => {
      const response = await request(app)
        .post("/api/courses")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ title: "AB", description: "Valid description here" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details).toContainEqual(
        expect.objectContaining({ field: "title" }),
      );
    });

    it("should return 400 for description too short", async () => {
      const response = await request(app)
        .post("/api/courses")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ title: "Valid Title", description: "Short" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details).toContainEqual(
        expect.objectContaining({ field: "description" }),
      );
    });
  });

  describe("GET /api/courses (list)", () => {
    const mockCourseRows = [
      {
        id: "course-1",
        title: "Course One",
        description: "First course description",
        instructor_id: "instructor-1",
        created_at: new Date("2024-01-01"),
      },
      {
        id: "course-2",
        title: "Course Two",
        description: "Second course description",
        instructor_id: "instructor-2",
        created_at: new Date("2024-01-02"),
      },
    ];

    it("should return paginated list of courses", async () => {
      // First call: count query, Second call: data query
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: "2" }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: mockCourseRows, rowCount: 2 });

      const response = await request(app)
        .get("/api/courses")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toMatchObject({
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
      });
    });

    it("should respect limit and offset params", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: "50" }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockCourseRows[0]], rowCount: 1 });

      const response = await request(app)
        .get("/api/courses?limit=10&offset=20")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.meta).toMatchObject({
        total: 50,
        limit: 10,
        offset: 20,
        hasMore: true,
      });
    });

    it("should filter by search term", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: "1" }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockCourseRows[0]], rowCount: 1 });

      const response = await request(app)
        .get("/api/courses?search=One")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Verify search param was used in query
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("ILIKE"),
        expect.arrayContaining(["%One%"]),
      );
    });

    it("should return 401 without auth token", async () => {
      const response = await request(app).get("/api/courses");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/courses/:id", () => {
    const mockCourseRow = {
      id: "course-123",
      title: "Test Course",
      description: "Test Description",
      instructor_id: "instructor-456",
      created_at: new Date("2024-01-01"),
    };

    it("should return course when found", async () => {
      mockQuery.mockResolvedValue({
        rows: [mockCourseRow],
        rowCount: 1,
      });

      const response = await request(app)
        .get("/api/courses/550e8400-e29b-41d4-a716-446655440000")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: "course-123",
        title: "Test Course",
      });
    });

    it("should return 404 when course not found", async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const response = await request(app)
        .get("/api/courses/550e8400-e29b-41d4-a716-446655440000")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ error: "Course not found" });
      expect(response.body.requestId).toBeDefined();
    });

    it("should return 401 without auth token", async () => {
      const response = await request(app).get(
        "/api/courses/550e8400-e29b-41d4-a716-446655440000",
      );

      expect(response.status).toBe(401);
    });

    it("should return 400 for invalid UUID format", async () => {
      const response = await request(app)
        .get("/api/courses/invalid-id")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  describe("Health check", () => {
    it("should return 200 on /health", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ status: "ok" });
      expect(response.body.requestId).toBeDefined();
    });
  });

  describe("404 handling", () => {
    it("should return 404 for unknown routes", async () => {
      const response = await request(app).get("/api/unknown");

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ error: "Not Found" });
      expect(response.body.requestId).toBeDefined();
    });
  });

  describe("Request ID header", () => {
    it("should return X-Request-ID header", async () => {
      const response = await request(app).get("/health");

      expect(response.headers["x-request-id"]).toBeDefined();
      expect(response.body.requestId).toBe(response.headers["x-request-id"]);
    });
  });
});
