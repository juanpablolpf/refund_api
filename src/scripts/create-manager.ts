// Uso: npm run create-manager -- "Nome" email@empresa.com senha
// Se o e-mail já existir, a conta é promovida a gestor (a senha não muda).
import { hash } from "bcrypt"
import { z } from "zod"
import { prisma } from "@/database/prisma"

const argsSchema = z.tuple([
    z.string().trim().min(2, "Nome é obrigatório"),
    z.string().trim().email("E-mail inválido").toLowerCase(),
    z.string().min(6, "A senha deve ter pelo menos 6 dígitos"),
])

async function main() {
    const parsed = argsSchema.safeParse(process.argv.slice(2))

    if (!parsed.success) {
        console.error('Uso: npm run create-manager -- "Nome" email@empresa.com senha')
        console.error(parsed.error.issues.map((issue) => issue.message).join("\n"))
        process.exit(1)
    }

    const [name, email, password] = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })

    if (existing) {
        await prisma.user.update({ where: { email }, data: { role: "manager" } })
        console.log(`${email} agora é gestor.`)
        return
    }

    await prisma.user.create({
        data: { name, email, password: await hash(password, 8), role: "manager" },
    })
    console.log(`Gestor ${email} criado.`)
}

main().finally(() => prisma.$disconnect())
