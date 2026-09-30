import { z } from "zod"

const envSchema = z.object({
    JWT_SECRET: z.string().min(32, "JWT_SECRET precisa ter pelo menos 32 caracteres"),
    PORT: z.coerce.number().default(3333),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
    console.error("Variáveis de ambiente inválidas:", parsed.error.flatten().fieldErrors)
    process.exit(1)
}

export const env = parsed.data
