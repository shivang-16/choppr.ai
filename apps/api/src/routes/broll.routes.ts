import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import { getBrollJob } from "../controllers/broll.controller.js";

const brollJobRouter = Router();
brollJobRouter.use(baseAuth);
brollJobRouter.get("/:jobId", getBrollJob);

export { brollJobRouter };
