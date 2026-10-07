import { Router } from "express"
import { sessionsRoutes } from "./sessions-routes"
import { refundsRoutes } from "./refunds-routes"
import { ensureAuthenticated } from "@/middlewares/ensure-authenticated"
import { uploadsRoutes } from "./uploads-routes"
import { organizationsRoutes, publicOrganizationsRoutes } from "./organizations-routes"
import { invitesRoutes, publicInvitesRoutes } from "./invites-routes"
import { publicUsersRoutes, usersRoutes } from "./users-routes"
import { meRoutes } from "./me-routes"
import { passwordRoutes } from "./password-routes"

const routes = Router()

//Rotas públicas
routes.use("/sessions", sessionsRoutes)
routes.use("/organizations", publicOrganizationsRoutes)
routes.use("/invites", publicInvitesRoutes)
routes.use("/users", publicUsersRoutes)
routes.use("/password", passwordRoutes)

//Rotas privadas
routes.use(ensureAuthenticated)
routes.use("/refunds", refundsRoutes)
routes.use("/uploads", uploadsRoutes)
routes.use("/organizations", organizationsRoutes)
routes.use("/invites", invitesRoutes)
routes.use("/users", usersRoutes)
routes.use("/me", meRoutes)

export { routes }
