import { Router } from "express";
import { OrganizationsController } from "@/controllers/organizations-controller";
import { verifyUserAuthorization } from "@/middlewares/verify-user-authorization";

const organizationsController = new OrganizationsController()

// Cadastro de uma empresa nova
const publicOrganizationsRoutes = Router()
publicOrganizationsRoutes.post("/", organizationsController.create)

const organizationsRoutes = Router()

organizationsRoutes.get(
    "/me",
    verifyUserAuthorization(["employee", "manager"]),
    organizationsController.show
)

organizationsRoutes.patch(
    "/me",
    verifyUserAuthorization(["manager"]),
    organizationsController.update
)

export {organizationsRoutes, publicOrganizationsRoutes}
