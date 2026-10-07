import { Request } from "express"
import { AppError } from "@/utils/AppError"

// Usuário logado (preenchido pelo ensureAuthenticated). Usar só em rotas privadas.
export function authUser(request: Request) {
    if (!request.user) {
        throw new AppError("Faça login para continuar", 401)
    }

    return request.user
}
