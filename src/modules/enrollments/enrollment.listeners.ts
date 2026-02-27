import { eventBus } from "@/infra/eventBus";
import { audit } from "@/utils";

export function registerEnrollmentListeners(): void {
  eventBus.on("enrollment:created", (p) => {
    audit({
      action: "ENROLLMENT_CREATED",
      userId: p.userId,
      metadata: { courseId: p.courseId, enrollmentId: p.enrollmentId },
    });
  });

  eventBus.on("enrollment:dropped", (p) => {
    audit({
      action: "ENROLLMENT_DROPPED",
      userId: p.userId,
      metadata: { courseId: p.courseId },
    });
  });
}
