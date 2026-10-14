import type { Response } from "express";

export function ok<T>(res: Response, data: T, message = "OK", status = 200) {
  return res.status(status).json({ success: true, message, data });
}

export function fail(res: Response, message: string, status = 400, data: unknown = null) {
  return res.status(status).json({ success: false, message, data });
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status = 400, data: unknown = null) {
    super(message);
    this.status = status;
    this.data = data;
  }
}
