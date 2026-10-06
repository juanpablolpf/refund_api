import { Router } from "express";
import { UsersController } from "@/controllers/users-controller";
import { verifyUserAuthorization } from "@/middlewares/verify-user-authorization";

const usersController = new UsersController()

// Cadastro por link de convite
const publicUsersRoutes = Router()
publicUsersRoutes.post("/", usersController.create)

const usersRoutes = Router()
usersRoutes.get("/", verifyUserAuthorization(["manager"]), usersController.index)

export{usersRoutes, publicUsersRoutes}
