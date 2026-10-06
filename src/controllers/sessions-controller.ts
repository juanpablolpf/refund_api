import { Request, Response } from "express"
import { z} from "zod"
import {prisma} from "@/database/prisma"
import { AppError } from "@/utils/AppError"
import { authConfig } from "@/configs/auth"
import { sign } from "jsonwebtoken"
import { compare } from "bcrypt"

class SessionsController {
    async create(request: Request, response: Response) {
        const bodySchema = z.object({
            email: z.string().trim().email({message: "E-mail inválido"}).toLowerCase(),
            password: z.string(),
        })

        const {email, password} = bodySchema.parse(request.body)

        const user = await prisma.user.findUnique({
            where: {email},
            include: {organization: {select: {id: true, name: true}}},
        })

        if (!user) {
            throw new AppError("E-mail ou senha inválido", 401)
        }

        const passwordMatched = await compare(password,user.password)

        if (!passwordMatched) {
            throw new AppError("E-mail ou senha inválido", 401)
        }

        const {secret, expiresIn} = authConfig.jwt

        const token = sign({role: user.role, org: user.organizationId}, secret, {
            subject: user.id,
            expiresIn,
        })

        const { password: _, ...userWithoutPassword } = user

        response.json({token, user: userWithoutPassword})
    }
}

export {SessionsController}
