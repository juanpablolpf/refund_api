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

export {refundsRoutes}