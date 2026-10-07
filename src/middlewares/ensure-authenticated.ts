import { verify } from "jsonwebtoken";
import { authConfig } from "@/configs/auth";
import { prisma } from "@/database/prisma";
import { AppError } from "@/utils/AppError";
import { Request, Response, NextFunction } from "express";

interface TokenPayload {
    role: string
    org?: string
    v?: number
    sub: string
}

function readToken(request: Request) {
    const authHeader = request.headers.authorization

    if (!authHeader) {
        throw new AppError("JWT token not found", 401)
    }

    const [scheme, token] = authHeader.split(" ")

    if (scheme !== "Bearer" || !token) {
        throw new AppError("Invalid JWT token", 401)
    }

    try {
        return verify(token, authConfig.jwt.secret, {algorithms: ["HS256"]}) as TokenPayload
    } catch {
        throw new AppError("Invalid JWT token", 401)
    }
}

async function ensureAuthenticated(request: Request, response: Response, next: NextFunction){
    const {role, org, v = 0, sub: user_id} = readToken(request)

    // Tokens emitidos antes das empresas não têm "org": a pessoa precisa entrar de novo
    if (!org) {
        throw new AppError("Invalid JWT token", 401)
    }

    // Conta apagada ou senha trocada depois deste login: o token não vale mais
    const user = await prisma.user.findUnique({where: {id: user_id}, select: {sessionVersion: true}})

    if (!user || user.sessionVersion !== v) {
        throw new AppError("Invalid JWT token", 401)
    }

    request.user = {
        id: user_id,
        role,
        organizationId: org,
    }

    return next()
}

export {ensureAuthenticated}
