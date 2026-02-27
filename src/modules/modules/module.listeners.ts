import { eventBus } from "@/infra/eventBus";
import { audit } from "@/utils";

export function registerModuleListeners(): void {
  eventBus.on("module:created", (p) => {
    audit({
      action: "MODULE_CREATED",
      userId: p.userId,
      metadata: { courseId: p.courseId, moduleId: p.moduleId, title: p.title },
    });
  });

  eventBus.on("module:updated", (p) => {
    audit({
      action: "MODULE_UPDATED",
      userId: p.userId,
      metadata: { courseId: p.courseId, moduleId: p.moduleId, title: p.title },
    });
  });

  eventBus.on("module:deleted", (p) => {
    audit({
      action: "MODULE_DELETED",
      userId: p.userId,
      metadata: { courseId: p.courseId, moduleId: p.moduleId },
    });
  });

  eventBus.on("module:reordered", (p) => {
    audit({
      action: "MODULE_REORDERED",
      userId: p.userId,
      metadata: { courseId: p.courseId },
    });
  });
}
