import { eventBus } from "@/infra/eventBus";
import { audit } from "@/utils";

export function registerProgressListeners(): void {
  eventBus.on("progress:updated", (p) => {
    audit({
      action: "PROGRESS_UPDATED",
      userId: p.userId,
      metadata: {
        lessonId: p.lessonId,
        status: p.status,
        progressPercent: p.progressPercent,
      },
    });
  });

  eventBus.on("progress:completed", (p) => {
    audit({
      action: "LESSON_COMPLETED",
      userId: p.userId,
      metadata: { lessonId: p.lessonId, courseId: p.courseId },
    });
  });
}
