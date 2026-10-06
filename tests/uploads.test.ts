import { beforeEach, describe, expect, it } from "vitest"
import { api, createRefund, createUser, FILES, resetDatabase, upload } from "./helpers"

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

    it("recusa formato que não é imagem nem PDF", async () => {
        const {token} = await createUser()

        const response = await upload(token, Buffer.from("MZ executável"), "programa.exe", "application/octet-stream")

        expect(response.status).toBe(400)
    })

    it("recusa arquivo disfarçado: diz que é JPG mas não é", async () => {
        const {token} = await createUser()

        const response = await upload(token, Buffer.from("<html>não sou foto</html>"), "foto.jpg", "image/jpeg")

        expect(response.status).toBe(400)
    })

    it("aceita PDF e guarda com a extensão certa", async () => {
        const {token} = await createUser()

        const response = await upload(token, FILES.pdf, "nota.pdf", "application/pdf")

        expect(response.status).toBe(200)
        expect(response.body.filename).toMatch(/-nota\.pdf$/)
    })

    it("corrige a extensão quando o conteúdo é de outro tipo", async () => {
        const {token} = await createUser()

        const response = await upload(token, FILES.png, "print.jpg", "image/jpeg")

        expect(response.body.filename).toMatch(/-print\.png$/)
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

    it("PDF é servido como PDF e sem o navegador adivinhar o tipo", async () => {
        const {token} = await createUser()
        const {body: {filename}} = await upload(token, FILES.pdf, "nota.pdf", "application/pdf")
        await api().post("/refunds").set("Authorization", `Bearer ${token}`)
            .send({name: "Nota", category: "food", amountInCents: 100, filename})

        const response = await api().get(`/uploads/${filename}`).set("Authorization", `Bearer ${token}`)

        expect(response.status).toBe(200)
        expect(response.headers["content-type"]).toContain("application/pdf")
        expect(response.headers["x-content-type-options"]).toBe("nosniff")
    })

    it("bloqueia tentativa de sair da pasta de uploads", async () => {
        const {token} = await createUser("manager")

        const response = await api().get("/uploads/..%2F..%2F.env").set("Authorization", `Bearer ${token}`)

        expect(response.status).toBe(404)
    })
})
