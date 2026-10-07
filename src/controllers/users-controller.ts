import { Request, Response } from "express"
import {prisma} from "@/database/prisma"
import {z} from "zod"
import { AppError } from "@/utils/AppError"
import { authUser } from "@/utils/auth-user"
import { activeInviteWhere, INVALID_INVITE } from "@/controllers/invites-controller"
import { hashPassword } from "@/utils/password"
import { ensureEmailIsFree, personSchema, userPublicSelect } from "@/utils/user-schemas"

class UsersController {
    // Cadastro público só com link de convite: a empresa e o papel vêm do convite.
    // Para criar uma empresa nova, o caminho é POST /organizations.
    async create(request: Request, response: Response) {
        const bodySchema = personSchema.extend({
            inviteToken: z.string({required_error: "O cadastro é feito pelo link de convite da sua empresa"}).min(10),
        })

        const {name, email, password, inviteToken} = bodySchema.parse(request.body)

        const invite = await prisma.invite.findFirst({where: {token: inviteToken, ...activeInviteWhere()}})

        if (!invite) {
            throw new AppError(INVALID_INVITE)
        }

        await ensureEmailIsFree(email)

        await prisma.$transaction([
            prisma.user.create({
                data: {
                    name,
                    email,
                    password: await hashPassword(password),
                    role: invite.role,
                    organizationId: invite.organizationId,
                },
            }),
            prisma.invite.update({where: {id: invite.id}, data: {usesCount: {increment: 1}}}),
        ])

        response.status(201).json()
    }

    // Gestor: equipe da própria empresa
    async index(request: Request, response: Response) {
        const {organizationId} = authUser(request)

        const users = await prisma.user.findMany({
            where: {organizationId},
            orderBy: [{role: "desc"}, {name: "asc"}],
            select: userPublicSelect,
        })

        response.json(users)
    }
}

export {UsersController}
