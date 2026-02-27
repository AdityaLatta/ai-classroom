import { eventBus } from "@/infra/eventBus";
import { audit } from "@/utils";

export function registerLessonListeners(): void {
  eventBus.on("lesson:created", (p) => {
    audit({
      action: "LESSON_CREATED",
      userId: p.userId,
      metadata: { moduleId: p.moduleId, lessonId: p.lessonId, title: p.title },
    });
  });

  eventBus.on("lesson:updated", (p) => {
    audit({
      action: "LESSON_UPDATED",
      userId: p.userId,
      metadata: { moduleId: p.moduleId, lessonId: p.lessonId, title: p.title },
    });
  });

  eventBus.on("lesson:deleted", (p) => {
    audit({
      action: "LESSON_DELETED",
      userId: p.userId,
      metadata: { moduleId: p.moduleId, lessonId: p.lessonId },
    });
  });
}
