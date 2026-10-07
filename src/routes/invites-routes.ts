import { Router } from "express"
import { InvitesController } from "@/controllers/invites-controller"
import { verifyUserAuthorization } from "@/middlewares/verify-user-authorization"

const invitesController = new InvitesController()

// Quem recebeu o link vê de qual empresa é o convite
const publicInvitesRoutes = Router()
publicInvitesRoutes.get("/:token", invitesController.show)

const invitesRoutes = Router()
invitesRoutes.use(verifyUserAuthorization(["manager"]))
invitesRoutes.post("/", invitesController.create)
invitesRoutes.get("/", invitesController.index)
invitesRoutes.delete("/:id", invitesController.revoke)

export { invitesRoutes, publicInvitesRoutes }
