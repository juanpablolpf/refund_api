import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/database/prisma"
import { monthRange } from "@/utils/period"
import { api, createOrganization, createRefund, createUser, resetDatabase } from "./helpers"

beforeEach(resetDatabase)

const auth = (token: string) => ["Authorization", `Bearer ${token}`] as const

describe("monthRange (horário de Brasília)", () => {
    it("23h do dia 30 de setembro em Brasília ainda é setembro", () => {
        // 2026-10-01 02:00 UTC = 2026-09-30 23:00 em Brasília
        const { start, end } = monthRange(0, new Date("2026-10-01T02:00:00Z"))

        expect(start.toISOString()).toBe("2026-09-01T03:00:00.000Z")
        expect(end.toISOString()).toBe("2026-10-01T03:00:00.000Z")
    })

    it("mês passado em janeiro volta para dezembro do ano anterior", () => {
        const { start } = monthRange(-1, new Date("2027-01-15T12:00:00Z"))

        expect(start.toISOString()).toBe("2026-12-01T03:00:00.000Z")
    })
})

describe("GET /refunds/summary", () => {
    it("soma pendentes e o que foi analisado neste mês, só da própria empresa", async () => {
        const employee = await createUser()
        const manager = await createUser("manager")
        await createRefund(employee.token, {amountInCents: 1000})
        await createRefund(employee.token, {amountInCents: 2500})
        const {body: toApprove} = await createRefund(employee.token, {amountInCents: 4000})
        const {body: toReject} = await createRefund(employee.token, {amountInCents: 700})
        const {body: oldApproved} = await createRefund(employee.token, {amountInCents: 9999})
        await api().patch(`/refunds/${toApprove.id}/approve`).set(...auth(manager.token))
        await api().patch(`/refunds/${toReject.id}/reject`).set(...auth(manager.token)).send({reason: "Sem nota"})
        await api().patch(`/refunds/${oldApproved.id}/approve`).set(...auth(manager.token))
        // Aprovado no mês passado não entra no "deste mês"
        await prisma.refunds.update({where: {id: oldApproved.id}, data: {reviewedAt: new Date(monthRange(-1).start.getTime() + 1000)}})

        const otherOrg = await createOrganization("Outra")
        const outsider = await createUser("employee", otherOrg.id)
        await createRefund(outsider.token, {amountInCents: 123456})

        const response = await api().get("/refunds/summary").set(...auth(manager.token))

        expect(response.status).toBe(200)
        expect(response.body.pending).toEqual({count: 2, amountInCents: 3500})
        expect(response.body.approvedThisMonth).toEqual({count: 1, amountInCents: 4000})
        expect(response.body.rejectedThisMonth).toEqual({count: 1, amountInCents: 700})
    })

    it("funcionário não vê o resumo", async () => {
        const {token} = await createUser()

        expect((await api().get("/refunds/summary").set(...auth(token))).status).toBe(403)
    })
})

describe("POST /refunds/approve (em lote)", () => {
    it("aprova os pendentes e pula os já analisados e os de outra empresa", async () => {
        const employee = await createUser()
        const manager = await createUser("manager")
        const {body: a} = await createRefund(employee.token)
        const {body: b} = await createRefund(employee.token)
        const {body: rejected} = await createRefund(employee.token)
        await api().patch(`/refunds/${rejected.id}/reject`).set(...auth(manager.token)).send({reason: "Duplicado"})

        const otherOrg = await createOrganization("Outra")
        const outsider = await createUser("employee", otherOrg.id)
        const {body: foreign} = await createRefund(outsider.token)

        const response = await api().post("/refunds/approve").set(...auth(manager.token)).send({ids: [a.id, b.id, rejected.id, foreign.id]})

        expect(response.body).toEqual({approved: 2, skipped: 2})
        const statuses = await prisma.refunds.findMany({where: {id: {in: [a.id, b.id, rejected.id, foreign.id]}}, select: {id: true, status: true, reviewedById: true}})
        const byId = Object.fromEntries(statuses.map((r) => [r.id, r]))
        expect(byId[a.id]).toMatchObject({status: "approved", reviewedById: manager.user.id})
        expect(byId[rejected.id].status).toBe("rejected")
        expect(byId[foreign.id].status).toBe("pending")
    })

    it("lista vazia é recusada e funcionário não aprova", async () => {
        const employee = await createUser()
        const manager = await createUser("manager")
        const {body: refund} = await createRefund(employee.token)

        expect((await api().post("/refunds/approve").set(...auth(manager.token)).send({ids: []})).status).toBe(400)
        expect((await api().post("/refunds/approve").set(...auth(employee.token)).send({ids: [refund.id]})).status).toBe(403)
    })
})

describe("GET /refunds/export", () => {
    it("gera CSV no formato do Excel em português, só da própria empresa", async () => {
        const employee = await createUser()
        const manager = await createUser("manager")
        await createRefund(employee.token, {name: "Almoço com cliente", amountInCents: 3550, category: "food"})
        await createRefund(employee.token, {name: "=HYPERLINK(\"http://mal.com\")", amountInCents: 100})

        const otherOrg = await createOrganization("Outra")
        const outsider = await createUser("employee", otherOrg.id)
        await createRefund(outsider.token, {name: "Pedido de outra empresa"})

        const response = await api().get("/refunds/export?period=all").set(...auth(manager.token)).buffer(true)
        const text = response.text

        expect(response.status).toBe(200)
        expect(response.headers["content-type"]).toContain("text/csv")
        expect(response.headers["content-disposition"]).toContain("attachment")
        expect(text.charCodeAt(0)).toBe(0xfeff)

        const lines = text.trim().split("\r\n")
        expect(lines[0]).toContain('"Data do pedido";"Funcionário"')
        expect(lines).toHaveLength(3)
        expect(text).toContain('"Almoço com cliente";"Alimentação";"35,50";"Em análise"')
        expect(text).toContain(`"'=HYPERLINK(""http://mal.com"")"`)
        expect(text).not.toContain("Pedido de outra empresa")
    })

    it("filtra por período e situação", async () => {
        const employee = await createUser()
        const manager = await createUser("manager")
        const {body: old} = await createRefund(employee.token, {name: "Antigo"})
        await createRefund(employee.token, {name: "Novo"})
        await prisma.refunds.update({where: {id: old.id}, data: {createdAt: new Date(monthRange(-1).start.getTime() + 1000)}})

        const thisMonth = await api().get("/refunds/export?period=this-month").set(...auth(manager.token)).buffer(true)
        const lastMonth = await api().get("/refunds/export?period=last-month").set(...auth(manager.token)).buffer(true)
        const approvedOnly = await api().get("/refunds/export?period=all&status=approved").set(...auth(manager.token)).buffer(true)

        expect(thisMonth.text).toContain("Novo")
        expect(thisMonth.text).not.toContain("Antigo")
        expect(lastMonth.text).toContain("Antigo")
        expect(lastMonth.text).not.toContain("Novo")
        expect(approvedOnly.text.trim().split("\r\n")).toHaveLength(1)
    })
})
