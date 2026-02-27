export type LessonType = "TEXT" | "VIDEO" | "LIVE_CLASS";

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  type: LessonType;
  content: string | null;
  videoUrl: string | null;
  order: number;
  durationMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLessonDTO {
  title: string;
  description?: string;
  type: LessonType;
  content?: string;
  videoUrl?: string;
  durationMinutes?: number;
}

export interface UpdateLessonDTO {
  title?: string;
  description?: string;
  type?: LessonType;
  content?: string;
  videoUrl?: string;
  durationMinutes?: number;
}

export interface ReorderLessonItem {
  id: string;
  order: number;
}

export interface ILessonRepository {
  create(moduleId: string, dto: CreateLessonDTO, order: number): Promise<Lesson>;
  findById(lessonId: string): Promise<Lesson | null>;
  findByModuleId(moduleId: string): Promise<Lesson[]>;
  update(lessonId: string, dto: UpdateLessonDTO): Promise<Lesson | null>;
  delete(lessonId: string): Promise<boolean>;
  reorder(moduleId: string, items: ReorderLessonItem[]): Promise<Lesson[]>;
  getNextOrder(moduleId: string): Promise<number>;
}
