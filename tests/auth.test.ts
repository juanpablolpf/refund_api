import { beforeEach, describe, expect, it } from "vitest"
import { sign } from "jsonwebtoken"
import { prisma } from "@/database/prisma"
import { api, createInvite, createUser, resetDatabase } from "./helpers"

beforeEach(resetDatabase)

async function signUpWithInvite(body: Record<string, unknown>) {
    const manager = await createUser("manager")
    const invite = await createInvite(manager.token)

    return api().post("/users").send({inviteToken: invite.token, ...body})
}

describe("POST /users", () => {
    it("exige link de convite", async () => {
        const response = await api()
            .post("/users")
            .send({name: "Sem Convite", email: "solto@teste.com", password: "123456"})

        expect(response.status).toBe(400)
        expect(await prisma.user.findUnique({where: {email: "solto@teste.com"}})).toBeNull()
    })

    it("o papel vem do convite, mesmo pedindo manager no corpo", async () => {
        const response = await signUpWithInvite({name: "Hacker", email: "hacker@teste.com", password: "123456", role: "manager"})

        expect(response.status).toBe(201)

        const user = await prisma.user.findUnique({where: {email: "hacker@teste.com"}})
        expect(user?.role).toBe("employee")
    })

    it("recusa e-mail repetido", async () => {
        const manager = await createUser("manager")
        const invite = await createInvite(manager.token)
        const body = {name: "Maria", email: "maria@teste.com", password: "123456", inviteToken: invite.token}
        await api().post("/users").send(body)

        const response = await api().post("/users").send(body)

        expect(response.status).toBe(400)
    })

    it("responde 400 para JSON malformado", async () => {
        const response = await api()
            .post("/users")
            .set("Content-Type", "application/json")
            .send("{nome: sem aspas")

        expect(response.status).toBe(400)
    })
})

describe("POST /sessions", () => {
    it("devolve token, a empresa e não devolve a senha", async () => {
        await signUpWithInvite({name: "Maria", email: "maria@teste.com", password: "123456"})

        const response = await api().post("/sessions").send({email: "Maria@Teste.com", password: "123456"})

        expect(response.status).toBe(200)
        expect(response.body.token).toEqual(expect.any(String))
        expect(response.body.user).not.toHaveProperty("password")
        expect(response.body.user.organization.name).toBe("Empresa Teste")
    })

    it("recusa senha errada", async () => {
        await signUpWithInvite({name: "Maria", email: "maria@teste.com", password: "123456"})

        const response = await api().post("/sessions").send({email: "maria@teste.com", password: "errada"})

        expect(response.status).toBe(401)
    })
})

describe("autenticação", () => {
    it("recusa rota privada sem token", async () => {
        const response = await api().get("/refunds")

        expect(response.status).toBe(401)
    })

    it("recusa token assinado com outro segredo", async () => {
        const fakeToken = sign({role: "manager", org: "qualquer"}, "juan", {subject: "qualquer-id"})

        const response = await api().get("/refunds").set("Authorization", `Bearer ${fakeToken}`)

        expect(response.status).toBe(401)
    })

    it("recusa token antigo, sem empresa", async () => {
        const {user} = await createUser("manager")
        const oldToken = sign({role: "manager"}, process.env.JWT_SECRET!, {subject: user.id})

        const response = await api().get("/refunds").set("Authorization", `Bearer ${oldToken}`)

        expect(response.status).toBe(401)
    })

    it("recusa funcionário em rota de gestor com 403", async () => {
        const {token} = await createUser("employee")

        const response = await api().get("/refunds").set("Authorization", `Bearer ${token}`)

        expect(response.status).toBe(403)
    })
})
