import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import {
  presignAssetUpload,
  listUserAssets,
  deleteUserAsset,
} from "../controllers/user-asset.controller.js";

const router = Router();

router.use(baseAuth);

router.post("/presign", presignAssetUpload);
router.get("/",         listUserAssets);
router.delete("/:assetId", deleteUserAsset);

export default router;
