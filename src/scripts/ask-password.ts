import readline from "node:readline"
import { personSchema } from "@/utils/user-schemas"

// Pede uma senha duas vezes no terminal sem mostrar o que é digitado.
// Lança erro se for curta demais ou se as duas não forem iguais.
export async function askPassword(label: string) {
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

    const ask = (question: string) =>
        new Promise<string>((resolve) => {
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
        const password = await ask(`${label} (não aparece ao digitar): `)
        const parsed = personSchema.shape.password.safeParse(password)

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
