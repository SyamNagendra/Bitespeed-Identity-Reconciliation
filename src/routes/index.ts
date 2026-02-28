import { Router } from "express";
import identifyRoutes from "./identify.routes";

const router = Router();

router.use(identifyRoutes);

export default router;
