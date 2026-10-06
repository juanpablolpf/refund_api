// Uso: npm run create-manager -- "Nome" email@empresa.com "Nome da empresa"
// Cria uma empresa nova com essa pessoa como gestora. A senha é pedida depois, sem aparecer na tela.
// Se o e-mail já existir, a conta é promovida a gestor na empresa dela (a senha não muda).
import readline from "node:readline"
import { hash } from "bcrypt"
import { z } from "zod"
import { prisma } from "@/database/prisma"

const USAGE = 'Uso: npm run create-manager -- "Nome" email@empresa.com "Nome da empresa"'

const argsSchema = z.object({
    name: z.string().trim().min(2, "Nome é obrigatório"),
    email: z.string().trim().email("E-mail inválido").toLowerCase(),
    organizationName: z.string().trim(),
})

const passwordSchema = z.string().min(6, "A senha deve ter pelo menos 6 caracteres")

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

async function askPassword() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    // Não ecoa o que é digitado
    ;(rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = () => {}

    // Fila de linhas: funciona tanto digitando quanto com a entrada vinda de um pipe
    const lines: string[] = []
    const waiting: ((line: string) => void)[] = []
    rl.on("line", (line) => {
        const next = waiting.shift()
        if (next) next(line)
        else lines.push(line)
    })
    rl.on("close", () => waiting.splice(0).forEach((resolve) => resolve("")))

    const ask = (question: string) => new Promise<string>((resolve) => {
        process.stdout.write(question)
        const done = (answer: string) => {
            process.stdout.write("\n")
            resolve(answer)
        }
        const line = lines.shift()
        if (line !== undefined) done(line)
        else waiting.push(done)
    })

    try {
        const password = await ask("Senha do gestor (não aparece ao digitar): ")
        const parsed = passwordSchema.safeParse(password)

        if (!parsed.success) {
            throw new Error(parsed.error.issues[0].message)
        }

        if (password !== (await ask("Repita a senha: "))) {
            throw new Error("As senhas não conferem")
        }

        return password
    } finally {
        rl.close()
    }
}

async function main() {
    const parsed = parseArgs(process.argv.slice(2))

    if (!parsed.success) {
        console.error(USAGE)
        console.error(parsed.error.issues.map((issue) => issue.message).join("\n"))
        process.exitCode = 1
        return
    }

    const {name, email, organizationName} = parsed.data

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

    const password = await askPassword()

    await prisma.organization.create({
        data: {
            name: organizationName,
            users: { create: { name, email, password: await hash(password, 8), role: "manager" } },
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
