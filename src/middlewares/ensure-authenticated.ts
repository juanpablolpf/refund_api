import { verify } from "jsonwebtoken";
import { authConfig } from "@/configs/auth";
import { AppError } from "@/utils/AppError";
import { Request, Response, NextFunction } from "express";

interface TokenPayload {
    role: string
    org?: string
    sub: string
}

function ensureAuthenticated(request: Request, response: Response, next: NextFunction){
    try {
        const authHeader = request.headers.authorization

        if (!authHeader) {
            throw new AppError("JWT token not found", 401)
        }

        const [scheme, token] = authHeader.split(" ")

        if (scheme !== "Bearer" || !token) {
            throw new AppError("Invalid JWT token", 401)
        }

        const {role, org, sub: user_id} = verify(token, authConfig.jwt.secret, {
            algorithms: ["HS256"],
        }) as TokenPayload

        // Tokens emitidos antes das empresas não têm "org": a pessoa precisa entrar de novo
        if (!org) {
            throw new AppError("Invalid JWT token", 401)
        }

        request.user = {
            id: user_id,
            role,
            organizationId: org,
        }

        return next()

    } catch (error) {
        throw new AppError("Invalid JWT token", 401)
    }
}

export {ensureAuthenticated}
