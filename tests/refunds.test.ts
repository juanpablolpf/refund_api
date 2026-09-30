import { beforeEach, describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import uploadConfig from "@/configs/upload"
import { api, createRefund, createUser, resetDatabase, uploadReceipt } from "./helpers"

const MISSING_ID = "00000000-0000-4000-8000-000000000000"

beforeEach(resetDatabase)

describe("POST /refunds", () => {
    it("cria pedido pendente com valor em centavos", async () => {
        const {token} = await createUser()

        const response = await createRefund(token, {amountInCents: 3550})

        expect(response.status).toBe(201)
        expect(response.body).toMatchObject({amountInCents: 3550, status: "pending"})
    })

    it("recusa valor quebrado (não está em centavos)", async () => {
        const {token} = await createUser()

        const response = await createRefund(token, {amountInCents: 35.5})

        expect(response.status).toBe(400)
    })

    it("recusa comprovante que não foi enviado", async () => {
        const {token} = await createUser()

        const response = await createRefund(token, {filename: "aaaaaaaaaaaaaaaaaaaa-nao-existe.jpg"})

        expect(response.status).toBe(400)
    })

    it("recusa comprovante já usado em outro pedido", async () => {
        const {token} = await createUser()
        const filename = await uploadReceipt(token)
        await createRefund(token, {filename})

        const response = await createRefund(token, {filename})

        expect(response.status).toBe(400)
    })
})

describe("GET /refunds e /refunds/me", () => {
    it("funcionário vê só os próprios pedidos", async () => {
        const maria = await createUser()
        const joao = await createUser()
        await createRefund(maria.token)
        await createRefund(maria.token)
        await createRefund(joao.token)

        const response = await api().get("/refunds/me").set("Authorization", `Bearer ${maria.token}`)

        expect(response.status).toBe(200)
        expect(response.body.pagination.totalRecords).toBe(2)
    })

    it("gestor vê todos, filtra por status e não recebe senhas", async () => {
        const employee = await createUser()
        const manager = await createUser("manager")
        const {body: refund} = await createRefund(employee.token)
        await createRefund(employee.token)
        await api().patch(`/refunds/${refund.id}/approve`).set("Authorization", `Bearer ${manager.token}`)

        const all = await api().get("/refunds").set("Authorization", `Bearer ${manager.token}`)
        const approved = await api().get("/refunds?status=approved").set("Authorization", `Bearer ${manager.token}`)

        expect(all.body.pagination.totalRecords).toBe(2)
        expect(approved.body.pagination.totalRecords).toBe(1)
        expect(JSON.stringify(all.body)).not.toContain("password")
    })
})

describe("GET /refunds/:id", () => {
    it("funcionário não vê pedido de outra pessoa", async () => {
        const maria = await createUser()
        const joao = await createUser()
        const {body: refund} = await createRefund(maria.token)

        const asOwner = await api().get(`/refunds/${refund.id}`).set("Authorization", `Bearer ${maria.token}`)
        const asOther = await api().get(`/refunds/${refund.id}`).set("Authorization", `Bearer ${joao.token}`)

        expect(asOwner.status).toBe(200)
        expect(asOther.status).toBe(404)
    })

    it("responde 404 para id inexistente", async () => {
        const {token} = await createUser("manager")

        const response = await api().get(`/refunds/${MISSING_ID}`).set("Authorization", `Bearer ${token}`)

        expect(response.status).toBe(404)
    })
})

describe("aprovar e recusar", () => {
    it("gestor recusa com motivo e fica registrado quem analisou", async () => {
        const employee = await createUser()
        const manager = await createUser("manager")
        const {body: refund} = await createRefund(employee.token)

        const response = await api()
            .patch(`/refunds/${refund.id}/reject`)
            .set("Authorization", `Bearer ${manager.token}`)
            .send({reason: "Comprovante ilegível"})

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
            status: "rejected",
            rejectionReason: "Comprovante ilegível",
            reviewedBy: {id: manager.user.id},
        })
    })

    it("exige motivo para recusar", async () => {
        const employee = await createUser()
        const manager = await createUser("manager")
        const {body: refund} = await createRefund(employee.token)

        const response = await api()
            .patch(`/refunds/${refund.id}/reject`)
            .set("Authorization", `Bearer ${manager.token}`)
            .send({})

        expect(response.status).toBe(400)
    })

    it("não deixa analisar o mesmo pedido duas vezes", async () => {
        const employee = await createUser()
        const manager = await createUser("manager")
        const {body: refund} = await createRefund(employee.token)
        await api().patch(`/refunds/${refund.id}/approve`).set("Authorization", `Bearer ${manager.token}`)

        const response = await api()
            .patch(`/refunds/${refund.id}/reject`)
            .set("Authorization", `Bearer ${manager.token}`)
            .send({reason: "Mudei de ideia"})

        expect(response.status).toBe(409)
    })

    it("funcionário não pode aprovar", async () => {
        const employee = await createUser()
        const {body: refund} = await createRefund(employee.token)

        const response = await api().patch(`/refunds/${refund.id}/approve`).set("Authorization", `Bearer ${employee.token}`)

        expect(response.status).toBe(403)
    })

    it("responde 404 para id inexistente", async () => {
        const {token} = await createUser("manager")

        const response = await api().patch(`/refunds/${MISSING_ID}/approve`).set("Authorization", `Bearer ${token}`)

        expect(response.status).toBe(404)
    })
})

describe("DELETE /refunds/:id", () => {
    it("funcionário cancela o próprio pedido pendente e o comprovante é apagado", async () => {
        const {token} = await createUser()
        const {body: refund} = await createRefund(token)

        const response = await api().delete(`/refunds/${refund.id}`).set("Authorization", `Bearer ${token}`)

        expect(response.status).toBe(204)
        expect(fs.existsSync(path.resolve(uploadConfig.UPLOADS_FOLDER, refund.filename))).toBe(false)
    })

    it("não cancela pedido já analisado", async () => {
        const employee = await createUser()
        const manager = await createUser("manager")
        const {body: refund} = await createRefund(employee.token)
        await api().patch(`/refunds/${refund.id}/approve`).set("Authorization", `Bearer ${manager.token}`)

        const response = await api().delete(`/refunds/${refund.id}`).set("Authorization", `Bearer ${employee.token}`)

        expect(response.status).toBe(409)
    })

    it("não cancela pedido de outra pessoa", async () => {
        const maria = await createUser()
        const joao = await createUser()
        const {body: refund} = await createRefund(maria.token)

        const response = await api().delete(`/refunds/${refund.id}`).set("Authorization", `Bearer ${joao.token}`)

        expect(response.status).toBe(404)
    })
})
