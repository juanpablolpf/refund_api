import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const TEST_DB = path.resolve("prisma", "test.db")
const TMP_FOLDERS = [path.resolve("tmp"), path.resolve("tmp", "uploads")]

function removeTestDatabase() {
    fs.rmSync(TEST_DB, {force: true})
    fs.rmSync(`${TEST_DB}-journal`, {force: true})
}

function listFiles(folder: string) {
    if (!fs.existsSync(folder)) return []
    return fs.readdirSync(folder, {withFileTypes: true})
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(folder, entry.name))
}

// Roda uma vez antes de todos os testes: cria um banco de teste do zero
export function setup() {
    removeTestDatabase()

    execSync("npx prisma migrate deploy", {
        env: {...process.env, DATABASE_URL: "file:./test.db"},
        stdio: "ignore",
    })

    const filesBefore = new Set(TMP_FOLDERS.flatMap(listFiles))

    // Roda uma vez depois de todos os testes: apaga o banco e os comprovantes criados
    return () => {
        removeTestDatabase()

        for (const file of TMP_FOLDERS.flatMap(listFiles)) {
            if (!filesBefore.has(file)) fs.rmSync(file)
        }
    }
}
