import { Router } from "express"
import { PasswordResetController } from "@/controllers/password-reset-controller"

const passwordResetController = new PasswordResetController()

// "Esqueci minha senha" (público)
const passwordRoutes = Router()
passwordRoutes.post("/forgot", passwordResetController.forgot)
passwordRoutes.post("/reset", passwordResetController.reset)

export { passwordRoutes }
