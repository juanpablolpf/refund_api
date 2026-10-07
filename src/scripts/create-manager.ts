// Uso: npm run create-manager -- "Nome" email@empresa.com "Nome da empresa"
// Cria uma empresa nova com essa pessoa como gestora. A senha é pedida depois, sem aparecer na tela.
// Se o e-mail já existir, a conta é promovida a gestor na empresa dela (a senha não muda).
import { z } from "zod"
import { prisma } from "@/database/prisma"
import { hashPassword } from "@/utils/password"
import { personSchema } from "@/utils/user-schemas"
import { askPassword } from "./ask-password"

const USAGE = 'Uso: npm run create-manager -- "Nome" email@empresa.com "Nome da empresa"'

const argsSchema = personSchema.pick({ name: true, email: true }).extend({ organizationName: z.string().trim() })

// Os nomes podem chegar em vários pedaços (ex.: aspas perdidas no Windows):
// tudo antes do e-mail é o nome da pessoa, tudo depois é o nome da empresa
function parseArgs(args: string[]) {
    const emailIndex = args.findIndex((arg) => arg.includes("@"))

    return argsSchema.safeParse({
        name: args.slice(0, emailIndex).join(" "),
        email: emailIndex >= 0 ? args[emailIndex] : "",
        organizationName: emailIndex >= 0 ? args.slice(emailIndex + 1).join(" ") : "",
    })
}

async function main() {
    const parsed = parseArgs(process.argv.slice(2))

    if (!parsed.success) {
        console.error(USAGE)
        console.error(parsed.error.issues.map((issue) => issue.message).join("\n"))
        process.exitCode = 1
        return
    }

    const { name, email, organizationName } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })

    if (existing) {
        await prisma.user.update({ where: { email }, data: { role: "manager" } })
        console.log(`${email} agora é gestor.`)
        return
    }

    if (organizationName.length < 2) {
        console.error(USAGE)
        console.error("Informe o nome da empresa para criar um gestor novo")
        process.exitCode = 1
        return
    }

    const password = await askPassword("Senha do gestor")

    await prisma.organization.create({
        data: {
            name: organizationName,
            users: { create: { name, email, password: await hashPassword(password), role: "manager" } },
        },
    })
    console.log(`Gestor ${email} criado na empresa "${organizationName}".`)
}

main()
    .catch((error) => {
        console.error(error.message)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
