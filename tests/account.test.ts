import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/database/prisma"
import { sentMails } from "@/providers/mail"
import { api, createUser, resetDatabase } from "./helpers"

beforeEach(async () => {
    await prisma.passwordResetToken.deleteMany()
    await resetDatabase()
    sentMails.length = 0
})

const auth = (token: string) => ["Authorization", `Bearer ${token}`] as const

function tokenFromMail() {
    const link = sentMails.at(-1)!.text.match(/\/redefinir-senha\/(\S+)/)
    return link![1]
}

describe("/me", () => {
    it("mostra a própria conta com a empresa, sem senha", async () => {
        const { token, user } = await createUser()

        const response = await api()
            .get("/me")
            .set(...auth(token))

        expect(response.body).toMatchObject({ id: user.id, email: user.email, organization: { name: "Empresa Teste" } })
        expect(response.body).not.toHaveProperty("password")
        expect(response.body).not.toHaveProperty("sessionVersion")
    })

    it("troca o próprio nome", async () => {
        const { token } = await createUser()

        const response = await api()
            .patch("/me")
            .set(...auth(token))
            .send({ name: "Nome Novo" })

        expect(response.body.name).toBe("Nome Novo")
    })

    it("login não devolve a versão da sessão", async () => {
        const { user } = await createUser()

        const response = await api().post("/sessions").send({ email: user.email, password: "123456" })

        expect(response.body.user).not.toHaveProperty("sessionVersion")
    })
})

describe("PATCH /me/password", () => {
    it("exige a senha atual certa", async () => {
        const { token } = await createUser()

        const response = await api()
            .patch("/me/password")
            .set(...auth(token))
            .send({ currentPassword: "errada", newPassword: "nova1234" })

        expect(response.status).toBe(400)
    })

    it("troca a senha, desconecta os outros aparelhos e mantém este logado", async () => {
        const { token: thisDevice, user } = await createUser()
        const otherDevice = (await api().post("/sessions").send({ email: user.email, password: "123456" })).body.token

        const response = await api()
            .patch("/me/password")
            .set(...auth(thisDevice))
            .send({ currentPassword: "123456", newPassword: "nova1234" })

        expect(response.status).toBe(200)
        expect(
            (
                await api()
                    .get("/me")
                    .set(...auth(response.body.token))
            ).status,
        ).toBe(200)
        expect(
            (
                await api()
                    .get("/me")
                    .set(...auth(otherDevice))
            ).status,
        ).toBe(401)
        expect(
            (
                await api()
                    .get("/me")
                    .set(...auth(thisDevice))
            ).status,
        ).toBe(401)
        expect((await api().post("/sessions").send({ email: user.email, password: "nova1234" })).status).toBe(200)
        expect((await api().post("/sessions").send({ email: user.email, password: "123456" })).status).toBe(401)
    })
})

describe("esqueci minha senha", () => {
    it("e-mail não cadastrado responde igual e não envia nada", async () => {
        const response = await api().post("/password/forgot").send({ email: "ninguem@teste.com" })

        expect(response.status).toBe(204)
        expect(sentMails).toHaveLength(0)
    })

    it("envia o link, que cria a senha nova e desconecta os logins antigos", async () => {
        const { token: oldSession, user } = await createUser()

        const forgot = await api().post("/password/forgot").send({ email: user.email.toUpperCase() })

        expect(forgot.status).toBe(204)
        expect(sentMails).toHaveLength(1)
        expect(sentMails[0].to).toBe(user.email)
        expect(sentMails[0].html).toContain("/redefinir-senha/")

        const reset = await api().post("/password/reset").send({ token: tokenFromMail(), password: "nova1234" })

        expect(reset.status).toBe(204)
        expect((await api().post("/sessions").send({ email: user.email, password: "nova1234" })).status).toBe(200)
        expect(
            (
                await api()
                    .get("/me")
                    .set(...auth(oldSession))
            ).status,
        ).toBe(401)
    })

    it("o link só funciona uma vez", async () => {
        const { user } = await createUser()
        await api().post("/password/forgot").send({ email: user.email })
        const token = tokenFromMail()

        await api().post("/password/reset").send({ token, password: "nova1234" })
        const again = await api().post("/password/reset").send({ token, password: "outra999" })

        expect(again.status).toBe(400)
        expect((await api().post("/sessions").send({ email: user.email, password: "nova1234" })).status).toBe(200)
    })

    it("link vencido não funciona", async () => {
        const { user } = await createUser()
        await api().post("/password/forgot").send({ email: user.email })
        await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })

        const response = await api().post("/password/reset").send({ token: tokenFromMail(), password: "nova1234" })

        expect(response.status).toBe(400)
    })

    it("não manda dois e-mails seguidos e um link novo anula o anterior", async () => {
        const { user } = await createUser()

        await api().post("/password/forgot").send({ email: user.email })
        await api().post("/password/forgot").send({ email: user.email })
        expect(sentMails).toHaveLength(1)
        const firstToken = tokenFromMail()

        // Passado o intervalo, um novo pedido gera outro link e o primeiro deixa de valer
        await prisma.passwordResetToken.updateMany({ data: { createdAt: new Date(Date.now() - 2 * 60 * 1000) } })
        await api().post("/password/forgot").send({ email: user.email })
        expect(sentMails).toHaveLength(2)

        const withOld = await api().post("/password/reset").send({ token: firstToken, password: "nova1234" })
        const withNew = await api().post("/password/reset").send({ token: tokenFromMail(), password: "nova1234" })

        expect(withOld.status).toBe(400)
        expect(withNew.status).toBe(204)
    })

    it("o banco guarda só o hash do token", async () => {
        const { user } = await createUser()
        await api().post("/password/forgot").send({ email: user.email })

        const stored = await prisma.passwordResetToken.findFirstOrThrow()

        expect(stored.tokenHash).not.toBe(tokenFromMail())
        expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    })
})
