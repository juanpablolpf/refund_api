import { Request } from "express"
import { AppError } from "@/utils/AppError"

// Usuário logado (preenchido pelo ensureAuthenticated). Usar só em rotas privadas.
export function authUser(request: Request) {
    if (!request.user) {
        throw new AppError("Unauthorized", 401)
    }

    return request.user
}
