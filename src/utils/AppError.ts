export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public isOperational = true,
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.name = "AppError";
  }
}
