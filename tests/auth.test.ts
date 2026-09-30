import { beforeEach, describe, expect, it } from "vitest"
import { sign } from "jsonwebtoken"
import { prisma } from "@/database/prisma"
import { api, createUser, resetDatabase } from "./helpers"

beforeEach(resetDatabase)

describe("POST /users", () => {
    it("cadastra sempre como funcionário, mesmo pedindo manager", async () => {
        const response = await api()
            .post("/users")
            .send({name: "Hacker", email: "hacker@teste.com", password: "123456", role: "manager"})

        expect(response.status).toBe(201)

        const user = await prisma.user.findUnique({where: {email: "hacker@teste.com"}})
        expect(user?.role).toBe("employee")
    })

    it("recusa e-mail repetido", async () => {
        const body = {name: "Maria", email: "maria@teste.com", password: "123456"}
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
    it("devolve token e não devolve a senha", async () => {
        await api().post("/users").send({name: "Maria", email: "maria@teste.com", password: "123456"})

        const response = await api().post("/sessions").send({email: "maria@teste.com", password: "123456"})

        expect(response.status).toBe(200)
        expect(response.body.token).toEqual(expect.any(String))
        expect(response.body.user).not.toHaveProperty("password")
    })

    it("recusa senha errada", async () => {
        await api().post("/users").send({name: "Maria", email: "maria@teste.com", password: "123456"})

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
        const fakeToken = sign({role: "manager"}, "juan", {subject: "qualquer-id"})

        const response = await api().get("/refunds").set("Authorization", `Bearer ${fakeToken}`)

        expect(response.status).toBe(401)
    })

    it("recusa funcionário em rota de gestor com 403", async () => {
        const {token} = await createUser("employee")

        const response = await api().get("/refunds").set("Authorization", `Bearer ${token}`)

        expect(response.status).toBe(403)
    })
})
