import { verify } from "jsonwebtoken";
import { authConfig } from "@/configs/auth";
import { AppError } from "@/utils/AppError";
import { Request, Response, NextFunction } from "express";

interface TokenPayload {
    role: string
    sub: string
}

function ensureAuthtenticated(request: Request, response: Response, next: NextFunction){
    try {
        const authHeader = request.headers.authorization

        if (!authHeader) {
            throw new AppError("JWT token not found", 401)
        }

        const [scheme, token] = authHeader.split(" ")

        if (scheme !== "Bearer" || !token) {
            throw new AppError("Invalid JWT token", 401)
        }

        const {role, sub: user_id} = verify(token, authConfig.jwt.secret, {
            algorithms: ["HS256"],
        }) as TokenPayload

        request.user = {
            id: user_id,
            role,
        }

        return next()

    } catch (error) {
        throw new AppError("Invalid JWT token", 401)
    }
}

export {ensureAuthtenticated}