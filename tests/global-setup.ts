import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

// Mesmo Postgres do desenvolvimento (docker compose), mas no schema "test"
const TEST_DATABASE_URL = "postgresql://docker:docker@localhost:5432/refund?schema=test"
const TMP_FOLDERS = [path.resolve("tmp"), path.resolve("tmp", "uploads")]

function prisma(command: string, input?: string) {
    execSync(`npx prisma ${command}`, {
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        input,
        stdio: input ? ["pipe", "ignore", "inherit"] : ["ignore", "ignore", "inherit"],
    })
}

function dropTestSchema() {
    prisma("db execute --stdin --schema prisma/schema.prisma", "DROP SCHEMA IF EXISTS test CASCADE;")
}

function listFiles(folder: string) {
    if (!fs.existsSync(folder)) return []
    return fs
        .readdirSync(folder, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(folder, entry.name))
}

// Roda uma vez antes de todos os testes: recria o schema de teste do zero
export function setup() {
    dropTestSchema()
    prisma("migrate deploy")

    const filesBefore = new Set(TMP_FOLDERS.flatMap(listFiles))

    // Roda uma vez depois de todos os testes: apaga o schema e os comprovantes criados
    return () => {
        dropTestSchema()

        for (const file of TMP_FOLDERS.flatMap(listFiles)) {
            if (!filesBefore.has(file)) fs.rmSync(file)
        }
    }
}
