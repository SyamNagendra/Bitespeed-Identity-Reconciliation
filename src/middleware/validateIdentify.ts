import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";
import { IdentifyRequestBody } from "../types/identify.types";

/**
 * Validates that at least one of email or phoneNumber is provided and non-empty.
 * Normalizes empty strings to undefined for consistent handling.
 */
export function validateIdentifyBody(
  req: Request<object, object, IdentifyRequestBody>,
  _res: Response,
  next: NextFunction
): void {
  const body = req.body;

  if (body == null || typeof body !== "object") {
    next(new AppError(400, "Request body must be a JSON object"));
    return;
  }

  const email =
    body.email === null || body.email === undefined
      ? undefined
      : typeof body.email === "string"
        ? body.email.trim() || undefined
        : undefined;

  const phoneNumber =
    body.phoneNumber === null || body.phoneNumber === undefined
      ? undefined
      : typeof body.phoneNumber === "string"
        ? body.phoneNumber.trim() || undefined
        : undefined;

  if (!email && !phoneNumber) {
    next(
      new AppError(
        400,
        "At least one of 'email' or 'phoneNumber' must be provided and non-empty"
      )
    );
    return;
  }

  req.body = { email, phoneNumber };
  next();
}
