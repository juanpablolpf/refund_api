import { z } from "zod"
import { prisma } from "@/database/prisma"
import { AppError } from "@/utils/AppError"

// Campos de pessoa usados no cadastro de empresa, no cadastro por convite, na conta e nos scripts
export const personSchema = z.object({
    name: z.string().trim().min(2, { message: "Nome é obrigatório" }),
    email: z.string().trim().email({ message: "E-mail inválido" }).toLowerCase(),
    password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres" }),
})

export async function ensureEmailIsFree(email: string) {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })

    if (existing) {
        throw new AppError("Já existe um usuário cadastrado com esse e-mail")
    }
}

// Dados de usuário que podem sair nas respostas (nunca a senha)
export const userPublicSelect = { id: true, name: true, email: true, role: true, createdAt: true }
