import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
    resolve: {
        alias: {"@": path.resolve(import.meta.dirname, "src")},
    },
    test: {
        globalSetup: "./tests/global-setup.ts",
        // Os arquivos de teste dividem o mesmo banco, então rodam um de cada vez
        fileParallelism: false,
        env: {
            NODE_ENV: "test",
            JWT_SECRET: "segredo-so-para-testes-com-32-caracteres-ou-mais",
            DATABASE_URL: "file:./test.db",
        },
    },
})
