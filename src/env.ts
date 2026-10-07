import { z } from "zod"

// Linha vazia no .env (ex.: "CORS_ORIGIN=") conta como não configurada
const optional = <T extends z.ZodTypeAny>(schema: T) =>
    z.preprocess((value) => (value === "" ? undefined : value), schema.optional())

const envSchema = z.object({
    JWT_SECRET: z.string().min(32, "JWT_SECRET precisa ter pelo menos 32 caracteres"),
    PORT: z.coerce.number().default(3333),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // Endereço do front que pode chamar a API (vazio = qualquer origem)
    CORS_ORIGIN: optional(z.string().url()),

    // Onde os comprovantes ficam: "disk" (pasta tmp/uploads) ou "s3" (Supabase, R2, AWS...)
    STORAGE_DRIVER: z.enum(["disk", "s3"]).default("disk"),
    S3_ENDPOINT: optional(z.string().url()),
    S3_REGION: optional(z.string()),
    S3_BUCKET: optional(z.string()),
    S3_ACCESS_KEY_ID: optional(z.string()),
    S3_SECRET_ACCESS_KEY: optional(z.string()),

    // Endereço do site, usado nos links dos e-mails (padrão: CORS_ORIGIN)
    APP_URL: optional(z.string().url()),

    // E-mails: "log" só mostra no terminal (desenvolvimento e testes); "resend" envia de verdade
    MAIL_DRIVER: z.enum(["log", "resend"]).default("log"),
    RESEND_API_KEY: optional(z.string()),
    // Remetente, ex.: "Refund <nao-responda@seudominio.com>" (sem domínio verificado: "Refund <onboarding@resend.dev>")
    MAIL_FROM: optional(z.string()),
}).superRefine((env, ctx) => {
    const requireKeys = (keys: readonly (keyof typeof env)[], reason: string) => {
        for (const key of keys) {
            if (!env[key]) ctx.addIssue({code: "custom", path: [key], message: `${key} é obrigatório quando ${reason}`})
        }
    }

    if (env.STORAGE_DRIVER === "s3") {
        requireKeys(["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"], "STORAGE_DRIVER=s3")
    }

    if (env.MAIL_DRIVER === "resend") {
        requireKeys(["RESEND_API_KEY", "MAIL_FROM"], "MAIL_DRIVER=resend")
    }
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
    console.error("Variáveis de ambiente inválidas:", parsed.error.flatten().fieldErrors)
    process.exit(1)
}

export const env = parsed.data
