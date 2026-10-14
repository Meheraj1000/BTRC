import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { ApiError } from "../lib/apiResponse.js";

function validationMessage(flatten: { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }) {
  const parts: string[] = [...flatten.formErrors];
  for (const [field, errors] of Object.entries(flatten.fieldErrors)) {
    if (errors?.length) parts.push(`${field}: ${errors.join(", ")}`);
  }
  return parts.length ? parts.join("; ") : "Validation failed";
}

export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const flatten = result.error.flatten();
      next(new ApiError(validationMessage(flatten), 422, flatten));
      return;
    }
    if (source === "query") {
      Object.assign(req.query, result.data);
    } else {
      req[source] = result.data as never;
    }
    next();
  };
}
