import { Request, Response } from "express"
import crypto from "node:crypto"
import { z } from "zod"
import { hash } from "bcrypt"
import { prisma } from "@/database/prisma"
import { env } from "@/env"
import { AppError } from "@/utils/AppError"
import { personSchema } from "@/utils/user-schemas"
import { mail } from "@/providers/mail"
import { passwordResetMail } from "@/providers/mail/templates"

const LINK_MINUTES = 60
// Evita encher a caixa de alguém: no máximo um e-mail por minuto para a mesma conta
const RESEND_AFTER_SECONDS = 60

const appUrl = env.APP_URL ?? env.CORS_ORIGIN ?? "http://localhost:5180"

function hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex")
}

class PasswordResetController {
    // Sempre responde igual, exista ou não a conta: assim ninguém descobre quais e-mails estão cadastrados
    async forgot(request: Request, response: Response) {
        const {email} = personSchema.pick({email: true}).parse(request.body)

        const user = await prisma.user.findUnique({where: {email}, select: {id: true, name: true, email: true}})

        if (user) {
            const recent = await prisma.passwordResetToken.findFirst({
                where: {userId: user.id, createdAt: {gt: new Date(Date.now() - RESEND_AFTER_SECONDS * 1000)}},
                select: {id: true},
            })

            if (!recent) {
                const token = crypto.randomBytes(32).toString("base64url")

                // Um link novo invalida os anteriores
                await prisma.$transaction([
                    prisma.passwordResetToken.deleteMany({where: {userId: user.id, usedAt: null}}),
                    prisma.passwordResetToken.create({
                        data: {
                            tokenHash: hashToken(token),
                            userId: user.id,
                            expiresAt: new Date(Date.now() + LINK_MINUTES * 60 * 1000),
                        },
                    }),
                ])

                const message = passwordResetMail(user.name, `${appUrl}/redefinir-senha/${token}`)
                await mail.send({to: user.email, ...message})
            }
        }

        response.status(204).send()
    }

    async reset(request: Request, response: Response) {
        const {token, password} = z.object({
            token: z.string().min(20, {message: "Link inválido"}),
            password: personSchema.shape.password,
        }).parse(request.body)

        const resetToken = await prisma.passwordResetToken.findUnique({where: {tokenHash: hashToken(token)}})

        if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
            throw new AppError("Este link não vale mais. Peça um novo em \"Esqueci minha senha\".")
        }

        // Marca como usado só se ninguém usou antes (dois cliques ao mesmo tempo)
        const {count} = await prisma.passwordResetToken.updateMany({
            where: {id: resetToken.id, usedAt: null},
            data: {usedAt: new Date()},
        })

        if (count === 0) {
            throw new AppError("Este link não vale mais. Peça um novo em \"Esqueci minha senha\".")
        }

        // Senha nova e todos os logins antigos desconectados
        await prisma.user.update({
            where: {id: resetToken.userId},
            data: {password: await hash(password, 8), sessionVersion: {increment: 1}},
        })

        response.status(204).send()
    }
}

export {PasswordResetController}
