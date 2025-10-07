import { Router } from "express";
import { usersRoutes } from "./users-routes";
import { sessionsRoutes } from "./sessions-routes";
import { refundsRoutes } from "./refunds-routes";
import { ensureAuthtenticated } from "@/middlewares/ensure-authtenticated";

const routes = Router()

//Rotas públicas
routes.use("/users", usersRoutes)
routes.use("/sessions", sessionsRoutes)

//Rotas privadas
routes.use(ensureAuthtenticated)
routes.use("/refunds", refundsRoutes)

export {routes}