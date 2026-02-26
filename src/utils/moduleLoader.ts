import fs from "fs";
import path from "path";
import { Router } from "express";
import { logger } from "./logger";

export interface ModuleDefinition {
  router: Router;
  /** URL prefix — defaults to the directory name (e.g. "auth" → /api/v1/auth) */
  prefix?: string;
  /** Optional lifecycle hooks for background jobs */
  lifecycle?: {
    start: () => void;
    stop: () => void;
  };
  /** Register domain event listeners for this module */
  listeners?: () => void;
  /** Module health check */
  healthCheck?: () => Promise<{ ok: boolean; details?: Record<string, unknown> }>;
}

export interface LoadedModule {
  name: string;
  prefix: string;
  definition: ModuleDefinition;
}

/**
 * Auto-discovers and loads all modules from src/modules/.
 *
 * A module is any subdirectory containing a *.module.{ts,js} file
 * that exports a `moduleDefinition` of type ModuleDefinition.
 * Directories without a module file (e.g. shared helpers) are skipped.
 */
export function loadModules(): LoadedModule[] {
  const modulesDir = path.join(__dirname, "..", "modules");
  const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
  const loaded: LoadedModule[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dirName = entry.name;
    const dirPath = path.join(modulesDir, dirName);
    const files = fs.readdirSync(dirPath);
    const moduleFile = files.find((f) => /\.module\.(ts|js)$/.test(f));

    if (!moduleFile) continue;

    const modulePath = path.join(
      dirPath,
      moduleFile.replace(/\.(ts|js)$/, ""),
    );

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(modulePath) as Record<string, unknown>;

    if (!mod.moduleDefinition) continue;

    const definition = mod.moduleDefinition as ModuleDefinition;
    const prefix = definition.prefix ?? dirName;

    // Register event listeners if provided
    if (definition.listeners) {
      definition.listeners();
      logger.info({ module: dirName }, "Listeners registered");
    }

    loaded.push({ name: dirName, prefix, definition });
    logger.info(
      { module: dirName, prefix: `/api/v1/${prefix}` },
      "Module loaded",
    );
  }

  return loaded;
}
