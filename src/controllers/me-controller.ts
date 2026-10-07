import { Request, Response } from "express"
import { z } from "zod"
import { prisma } from "@/database/prisma"
import { AppError } from "@/utils/AppError"
import { authUser } from "@/utils/auth-user"
import { personSchema } from "@/utils/user-schemas"
import { signSessionToken } from "@/utils/session-token"
import { hashPassword, passwordMatches } from "@/utils/password"

const meSelect = {
    id: true, name: true, email: true, role: true,
    organization: {select: {id: true, name: true}},
}

// Conta da própria pessoa logada (funcionário ou gestor)
class MeController {
    async show(request: Request, response: Response) {
        const user = await prisma.user.findUniqueOrThrow({where: {id: authUser(request).id}, select: meSelect})

        response.json(user)
    }

    async update(request: Request, response: Response) {
        const {name} = personSchema.pick({name: true}).parse(request.body)

        const user = await prisma.user.update({where: {id: authUser(request).id}, data: {name}, select: meSelect})

        response.json(user)
    }

    // Troca a senha sabendo a atual. Desconecta os outros aparelhos e devolve um login novo para este.
    async changePassword(request: Request, response: Response) {
        const {currentPassword, newPassword} = z.object({
            currentPassword: z.string().min(1, {message: "Informe a senha atual"}),
            newPassword: personSchema.shape.password,
        }).parse(request.body)

        const user = await prisma.user.findUniqueOrThrow({where: {id: authUser(request).id}})

        if (!(await passwordMatches(currentPassword, user.password))) {
            throw new AppError("A senha atual não confere")
        }

        const updated = await prisma.user.update({
            where: {id: user.id},
            data: {password: await hashPassword(newPassword), sessionVersion: {increment: 1}},
        })

        response.json({token: signSessionToken(updated)})
    }
}

export {MeController}
