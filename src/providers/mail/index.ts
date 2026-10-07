import { env } from "@/env"

export type Mail = {
    to: string
    subject: string
    text: string
    html: string
}

export interface MailProvider {
    send(mail: Mail): Promise<void>
}

// Desenvolvimento e testes: não envia nada, mostra no terminal e guarda em memória
export const sentMails: Mail[] = []

class LogMail implements MailProvider {
    async send(mail: Mail) {
        sentMails.push(mail)
        if (env.NODE_ENV !== "test") {
            console.log(`\n[e-mail para ${mail.to}] ${mail.subject}\n${mail.text}\n`)
        }
    }
}

// Produção: API HTTP do Resend (https://resend.com/docs/api-reference/emails/send-email)
class ResendMail implements MailProvider {
    async send(mail: Mail) {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: env.MAIL_FROM,
                to: [mail.to],
                subject: mail.subject,
                text: mail.text,
                html: mail.html,
            }),
        })

        if (!response.ok) {
            // O erro fica só no log do servidor (quem pediu não deve saber se o e-mail existe)
            console.error("Falha ao enviar e-mail pelo Resend:", response.status, await response.text())
        }
    }
}

export const mail: MailProvider = env.MAIL_DRIVER === "resend" ? new ResendMail() : new LogMail()
