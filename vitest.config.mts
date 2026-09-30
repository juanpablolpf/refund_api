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
            DATABASE_URL: "postgresql://docker:docker@localhost:5432/refund?schema=test",
            // Padrão "disk"; para testar o S3, rode com STORAGE_DRIVER=s3 e as variáveis S3_*
            STORAGE_DRIVER: process.env.STORAGE_DRIVER ?? "disk",
        },
    },
})
