import { z } from "zod"

const envSchema = z.object({
    JWT_SECRET: z.string().min(32, "JWT_SECRET precisa ter pelo menos 32 caracteres"),
    PORT: z.coerce.number().default(3333),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // Endereço do front que pode chamar a API (vazio = qualquer origem)
    CORS_ORIGIN: z.string().url().optional(),

    // Onde os comprovantes ficam: "disk" (pasta tmp/uploads) ou "s3" (Supabase, R2, AWS...)
    STORAGE_DRIVER: z.enum(["disk", "s3"]).default("disk"),
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
}).superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER !== "s3") return

    const required = ["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const

    for (const key of required) {
        if (!env[key]) {
            ctx.addIssue({code: "custom", path: [key], message: `${key} é obrigatório quando STORAGE_DRIVER=s3`})
        }
    }
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
    console.error("Variáveis de ambiente inválidas:", parsed.error.flatten().fieldErrors)
    process.exit(1)
}

export const env = parsed.data
