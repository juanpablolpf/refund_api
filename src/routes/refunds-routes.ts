import { Router } from "express";
import { RefundsController } from "@/controllers/refunds-controllers";
import { verifyUserAuthorization } from "@/middlewares/verify-user-authorization";

const refundsRoutes = Router()
const refundsController = new RefundsController()

refundsRoutes.post(
    "/",
    verifyUserAuthorization(["employee"]),
    refundsController.create)

refundsRoutes.get(
    "/",
    verifyUserAuthorization(["manager"]),
    refundsController.index
)

// Precisa vir antes de "/:id", senão "me" seria lido como id
refundsRoutes.get(
    "/me",
    verifyUserAuthorization(["employee"]),
    refundsController.mine
)

refundsRoutes.get(
    "/:id",
    verifyUserAuthorization(["employee", "manager"]),
    refundsController.show
)

refundsRoutes.patch(
    "/:id/approve",
    verifyUserAuthorization(["manager"]),
    refundsController.approve
)

refundsRoutes.patch(
    "/:id/reject",
    verifyUserAuthorization(["manager"]),
    refundsController.reject
)

refundsRoutes.delete(
    "/:id",
    verifyUserAuthorization(["employee"]),
    refundsController.remove
)

export {refundsRoutes}
