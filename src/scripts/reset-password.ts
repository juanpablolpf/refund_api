// Uso: npm run reset-password -- email@empresa.com
// Troca a senha de qualquer usuário e desconecta os logins abertos. A senha nova é pedida depois, sem aparecer na tela.
import { prisma } from "@/database/prisma"
import { hashPassword } from "@/utils/password"
import { personSchema } from "@/utils/user-schemas"
import { askPassword } from "./ask-password"

const USAGE = "Uso: npm run reset-password -- email@empresa.com"

async function main() {
    const parsed = personSchema.shape.email.safeParse(process.argv[2] ?? "")

    if (!parsed.success) {
        console.error(USAGE)
        console.error(parsed.error.issues[0].message)
        process.exitCode = 1
        return
    }

    const email = parsed.data
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })

    if (!user) {
        console.error(`Nenhum usuário com o e-mail ${email}.`)
        process.exitCode = 1
        return
    }

    const password = await askPassword(`Nova senha de ${email}`)

    await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(password), sessionVersion: { increment: 1 } } })
    console.log(`Senha de ${email} alterada.`)
}

main()
    .catch((error) => {
        console.error(error.message)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
