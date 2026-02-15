import { Response } from "express";
import { PaginationMeta } from "./pagination";

export class AppResponse {
  static ok<T>(res: Response, data: T): void {
    res.status(200).json({ data });
  }

  static created<T>(res: Response, data: T): void {
    res.status(201).json({ data });
  }

  static message(res: Response, message: string, status = 200): void {
    res.status(status).json({ message });
  }

  static paginated<T>(res: Response, data: T[], meta: PaginationMeta): void {
    res.status(200).json({ data, meta });
  }
}
