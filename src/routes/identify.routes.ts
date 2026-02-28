import { Router } from "express";
import { identify } from "../controllers/identify.controller";
import { validateIdentifyBody } from "../middleware/validateIdentify";

const router = Router();

router.post("/identify", validateIdentifyBody, identify);

export default router;
