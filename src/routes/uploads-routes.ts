import { Router } from "express"
import { UploadsController } from "@/controllers/uploads-controller"
import { verifyUserAuthorization } from "@/middlewares/verify-user-authorization"
import multer from "multer"
import uploadConfig from "@/configs/upload"

const uploadsRoutes = Router()
const uploadsController = new UploadsController()

const upload = multer(uploadConfig.MULTER)

uploadsRoutes.post("/", verifyUserAuthorization(["employee"]), upload.single("file"), uploadsController.create)

uploadsRoutes.get("/:filename", verifyUserAuthorization(["employee", "manager"]), uploadsController.show)

export { uploadsRoutes }
