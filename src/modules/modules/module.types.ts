export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateModuleDTO {
  title: string;
  description?: string;
}

export interface UpdateModuleDTO {
  title?: string;
  description?: string;
}

export interface ReorderModuleItem {
  id: string;
  order: number;
}

export interface IModuleRepository {
  create(courseId: string, dto: CreateModuleDTO, order: number): Promise<CourseModule>;
  findById(moduleId: string): Promise<CourseModule | null>;
  findByCourseId(courseId: string): Promise<CourseModule[]>;
  update(moduleId: string, dto: UpdateModuleDTO): Promise<CourseModule | null>;
  delete(moduleId: string): Promise<boolean>;
  reorder(courseId: string, items: ReorderModuleItem[]): Promise<CourseModule[]>;
  getNextOrder(courseId: string): Promise<number>;
}
