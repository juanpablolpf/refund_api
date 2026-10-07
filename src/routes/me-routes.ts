import { Router } from "express";
import { MeController } from "@/controllers/me-controller";

const meController = new MeController()

// Conta de quem está logado (qualquer papel)
const meRoutes = Router()
meRoutes.get("/", meController.show)
meRoutes.patch("/", meController.update)
meRoutes.patch("/password", meController.changePassword)

export {meRoutes}
