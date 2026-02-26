import { eventBus } from "@/infra/eventBus";
import { audit } from "@/utils";

export function registerCourseListeners(): void {
  eventBus.on("course:created", (p) => {
    audit({ action: "COURSE_CREATED", userId: p.userId, metadata: { courseId: p.courseId, title: p.title } });
  });

  eventBus.on("course:updated", (p) => {
    audit({ action: "COURSE_UPDATED", userId: p.userId, metadata: { courseId: p.courseId, title: p.title } });
  });

  eventBus.on("course:deleted", (p) => {
    audit({ action: "COURSE_DELETED", userId: p.userId, metadata: { courseId: p.courseId } });
  });
}
