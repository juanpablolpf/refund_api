import { beforeEach, describe, expect, it } from "vitest"
import { api, createRefund, createUser, resetDatabase } from "./helpers"

beforeEach(resetDatabase)

describe("POST /uploads", () => {
    it("recusa arquivo maior que 3MB", async () => {
        const {token} = await createUser()

        const response = await api()
            .post("/uploads")
            .set("Authorization", `Bearer ${token}`)
            .attach("file", Buffer.alloc(3 * 1024 * 1024 + 1), {filename: "grande.jpg", contentType: "image/jpeg"})

        expect(response.status).toBe(400)
    })

    it("recusa formato que não é imagem", async () => {
        const {token} = await createUser()

        const response = await api()
            .post("/uploads")
            .set("Authorization", `Bearer ${token}`)
            .attach("file", Buffer.from("%PDF"), {filename: "nota.pdf", contentType: "application/pdf"})

        expect(response.status).toBe(400)
    })
})

describe("GET /uploads/:filename", () => {
    it("só o dono e o gestor abrem o comprovante", async () => {
        const maria = await createUser()
        const joao = await createUser()
        const manager = await createUser("manager")
        const {body: refund} = await createRefund(maria.token)
        const url = `/uploads/${refund.filename}`

        expect((await api().get(url)).status).toBe(401)
        expect((await api().get(url).set("Authorization", `Bearer ${joao.token}`)).status).toBe(404)
        expect((await api().get(url).set("Authorization", `Bearer ${maria.token}`)).status).toBe(200)
        expect((await api().get(url).set("Authorization", `Bearer ${manager.token}`)).status).toBe(200)
    })

    it("bloqueia tentativa de sair da pasta de uploads", async () => {
        const {token} = await createUser("manager")

        const response = await api().get("/uploads/..%2F..%2F.env").set("Authorization", `Bearer ${token}`)

        expect(response.status).toBe(404)
    })
})
