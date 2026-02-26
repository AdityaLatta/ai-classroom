import { Router, RequestHandler } from "express";
import { asyncHandler } from "./asyncHandler";

// Polyfill Symbol.metadata for ES2020 target
(Symbol as any).metadata ??= Symbol("Symbol.metadata");

interface RouteDef {
  method: "get" | "post" | "put" | "delete" | "patch";
  path: string;
  middleware: RequestHandler[];
  handlerKey: string;
}

const ROUTES_KEY = Symbol("routes");

function routeDecorator(
  method: RouteDef["method"],
  path: string,
  ...middleware: RequestHandler[]
) {
  return function (
    _target: unknown,
    context: ClassMethodDecoratorContext,
  ): void {
    const meta = context.metadata as Record<symbol, unknown>;
    const routes: RouteDef[] = (meta[ROUTES_KEY] as RouteDef[] | undefined) ?? [];
    routes.push({
      method,
      path,
      middleware,
      handlerKey: String(context.name),
    });
    meta[ROUTES_KEY] = routes;
  };
}

export function Get(path: string, ...middleware: RequestHandler[]) {
  return routeDecorator("get", path, ...middleware);
}

export function Post(path: string, ...middleware: RequestHandler[]) {
  return routeDecorator("post", path, ...middleware);
}

export function Put(path: string, ...middleware: RequestHandler[]) {
  return routeDecorator("put", path, ...middleware);
}

export function Delete(path: string, ...middleware: RequestHandler[]) {
  return routeDecorator("delete", path, ...middleware);
}

export function Patch(path: string, ...middleware: RequestHandler[]) {
  return routeDecorator("patch", path, ...middleware);
}

export function buildRouter(controller: object): Router {
  const router = Router();
  const metadata = (controller.constructor as any)[(Symbol as any).metadata] as
    | Record<symbol, unknown>
    | undefined;

  if (!metadata?.[ROUTES_KEY]) {
    throw new Error(
      `No routes found on ${controller.constructor.name}. Did you forget to add route decorators?`,
    );
  }

  const routes = metadata[ROUTES_KEY] as RouteDef[];

  for (const route of routes) {
    const handler = (controller as any)[route.handlerKey].bind(controller);
    router[route.method](
      route.path,
      ...route.middleware,
      asyncHandler(handler),
    );
  }

  return router;
}
