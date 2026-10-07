import { Request, Response, NextFunction } from "express"
import { verify } from "jsonwebtoken"
import { z } from "zod"
import { authConfig } from "@/configs/auth"
import { prisma } from "@/database/prisma"
import { AppError } from "@/utils/AppError"

const INVALID_SESSION = "Sua sessão terminou. Entre de novo."

// Formato do token criado em utils/session-token
const tokenPayloadSchema = z.object({
    sub: z.string(),
    role: z.enum(["employee", "manager"]),
    org: z.string(),
    v: z.number().int(),
})

function readToken(request: Request) {
    const [scheme, token] = request.headers.authorization?.split(" ") ?? []

    if (scheme !== "Bearer" || !token) {
        throw new AppError("Faça login para continuar", 401)
    }

    try {
        return tokenPayloadSchema.parse(verify(token, authConfig.jwt.secret, { algorithms: ["HS256"] }))
    } catch {
        throw new AppError(INVALID_SESSION, 401)
    }
}

async function ensureAuthenticated(request: Request, response: Response, next: NextFunction) {
    const { sub: userId, role, org, v } = readToken(request)

    // Conta apagada ou senha trocada depois deste login: o token não vale mais
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } })

    if (!user || user.sessionVersion !== v) {
        throw new AppError(INVALID_SESSION, 401)
    }

    request.user = { id: userId, role, organizationId: org }

    return next()
}

export { ensureAuthenticated }
