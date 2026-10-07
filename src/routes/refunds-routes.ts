import { Router } from "express"
import { RefundsController } from "@/controllers/refunds-controllers"
import { RefundsReportsController } from "@/controllers/refunds-reports-controller"
import { verifyUserAuthorization } from "@/middlewares/verify-user-authorization"

const refundsRoutes = Router()
const refundsController = new RefundsController()
const reportsController = new RefundsReportsController()

refundsRoutes.post("/", verifyUserAuthorization(["employee"]), refundsController.create)

refundsRoutes.get("/", verifyUserAuthorization(["manager"]), refundsController.index)

// Rotas com nome fixo precisam vir antes de "/:id", senão o nome seria lido como id
refundsRoutes.get("/summary", verifyUserAuthorization(["manager"]), reportsController.summary)

refundsRoutes.get("/export", verifyUserAuthorization(["manager"]), reportsController.export)

refundsRoutes.post("/approve", verifyUserAuthorization(["manager"]), refundsController.approveMany)

refundsRoutes.get("/me", verifyUserAuthorization(["employee"]), refundsController.mine)

refundsRoutes.get("/:id", verifyUserAuthorization(["employee", "manager"]), refundsController.show)

refundsRoutes.patch("/:id/approve", verifyUserAuthorization(["manager"]), refundsController.approve)

refundsRoutes.patch("/:id/reject", verifyUserAuthorization(["manager"]), refundsController.reject)

refundsRoutes.patch("/:id", verifyUserAuthorization(["employee"]), refundsController.update)

refundsRoutes.delete("/:id", verifyUserAuthorization(["employee"]), refundsController.remove)

export { refundsRoutes }
