import { Request, Response, NextFunction } from "express";
import { identify as identifyService } from "../services/identify.service";
import { IdentifyRequestBody } from "../types/identify.types";

export async function identify(
  req: Request<object, object, IdentifyRequestBody>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as IdentifyRequestBody;
    const result = await identifyService(body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
