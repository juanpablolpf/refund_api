import { Request, Response } from "express"
import crypto from "node:crypto"
import { z } from "zod"
import { prisma } from "@/database/prisma"
import { AppError } from "@/utils/AppError"
import { authUser } from "@/utils/auth-user"

const INVITE_DAYS = 7

export const INVALID_INVITE = "Convite inválido ou vencido. Peça um novo link ao gestor da sua empresa."

// Convite válido: não foi revogado e ainda não venceu
export function activeInviteWhere() {
    return { revokedAt: null, expiresAt: { gt: new Date() } }
}

const inviteSelect = { id: true, token: true, role: true, usesCount: true, expiresAt: true, createdAt: true }

class InvitesController {
    async create(request: Request, response: Response) {
        const user = authUser(request)

        const { role } = z.object({ role: z.enum(["employee", "manager"]).default("employee") }).parse(request.body)

        const invite = await prisma.invite.create({
            data: {
                token: crypto.randomBytes(24).toString("base64url"),
                role,
                organizationId: user.organizationId,
                createdById: user.id,
                expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
            },
            select: inviteSelect,
        })

        response.status(201).json(invite)
    }

    // Links ainda válidos da empresa, do mais novo para o mais antigo
    async index(request: Request, response: Response) {
        const { organizationId } = authUser(request)

        const invites = await prisma.invite.findMany({
            where: { organizationId, ...activeInviteWhere() },
            orderBy: { createdAt: "desc" },
            select: inviteSelect,
        })

        response.json(invites)
    }

    // Público: a tela de cadastro por convite mostra o nome da empresa antes de a pessoa se cadastrar
    async show(request: Request, response: Response) {
        const { token } = z.object({ token: z.string().min(10) }).parse(request.params)

        const invite = await prisma.invite.findFirst({
            where: { token, ...activeInviteWhere() },
            select: { role: true, expiresAt: true, organization: { select: { name: true } } },
        })

        if (!invite) {
            throw new AppError(INVALID_INVITE, 404)
        }

        response.json({ organizationName: invite.organization.name, role: invite.role, expiresAt: invite.expiresAt })
    }

    async revoke(request: Request, response: Response) {
        const { organizationId } = authUser(request)
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

        const { count } = await prisma.invite.updateMany({
            where: { id, organizationId, revokedAt: null },
            data: { revokedAt: new Date() },
        })

        if (count === 0) {
            throw new AppError("Convite não encontrado", 404)
        }

        response.status(204).send()
    }
}

export { InvitesController }
