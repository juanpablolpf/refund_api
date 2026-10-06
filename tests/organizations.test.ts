import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/database/prisma"
import { api, createInvite, createOrganization, createRefund, createUser, resetDatabase } from "./helpers"

beforeEach(resetDatabase)

const auth = (token: string) => ["Authorization", `Bearer ${token}`] as const

describe("POST /organizations", () => {
    it("cria a empresa e a primeira pessoa como gestora", async () => {
        const response = await api().post("/organizations").send({
            organizationName: "Padaria Pão Quente",
            name: "Rita Dona",
            email: "rita@padaria.com",
            password: "123456",
        })

        expect(response.status).toBe(201)
        expect(response.body.name).toBe("Padaria Pão Quente")

        const login = await api().post("/sessions").send({email: "rita@padaria.com", password: "123456"})
        expect(login.body.user.role).toBe("manager")
        expect(login.body.user.organization.name).toBe("Padaria Pão Quente")
    })

    it("recusa e-mail que já existe em qualquer empresa", async () => {
        const {user} = await createUser("employee")

        const response = await api().post("/organizations").send({
            organizationName: "Outra",
            name: "Alguém",
            email: user.email,
            password: "123456",
        })

        expect(response.status).toBe(400)
        expect(await prisma.organization.count()).toBe(1)
    })

    it("exige o nome da empresa", async () => {
        const response = await api().post("/organizations").send({name: "Rita", email: "rita@x.com", password: "123456"})

        expect(response.status).toBe(400)
    })
})

describe("/organizations/me", () => {
    it("gestor renomeia a empresa; funcionário não", async () => {
        const manager = await createUser("manager")
        const employee = await createUser("employee")

        const renamed = await api().patch("/organizations/me").set(...auth(manager.token)).send({name: "Nome Novo"})
        const blocked = await api().patch("/organizations/me").set(...auth(employee.token)).send({name: "Hack"})
        const shown = await api().get("/organizations/me").set(...auth(employee.token))

        expect(renamed.status).toBe(200)
        expect(blocked.status).toBe(403)
        expect(shown.body.name).toBe("Nome Novo")
    })
})

describe("convites", () => {
    it("link público mostra a empresa e cadastra com o papel do convite", async () => {
        const manager = await createUser("manager")
        const invite = await createInvite(manager.token, "manager")

        const info = await api().get(`/invites/${invite.token}`)
        expect(info.body).toMatchObject({organizationName: "Empresa Teste", role: "manager"})

        const signup = await api().post("/users").send({name: "Nova Gestora", email: "nova@teste.com", password: "123456", inviteToken: invite.token})
        expect(signup.status).toBe(201)

        const user = await prisma.user.findUnique({where: {email: "nova@teste.com"}})
        expect(user).toMatchObject({role: "manager", organizationId: manager.user.organizationId})
        expect((await prisma.invite.findUnique({where: {id: invite.id}}))?.usesCount).toBe(1)
    })

    it("o mesmo link serve para várias pessoas", async () => {
        const manager = await createUser("manager")
        const invite = await createInvite(manager.token)

        for (const email of ["a@teste.com", "b@teste.com"]) {
            const response = await api().post("/users").send({name: "Pessoa", email, password: "123456", inviteToken: invite.token})
            expect(response.status).toBe(201)
        }
    })

    it("convite revogado ou vencido não funciona", async () => {
        const manager = await createUser("manager")
        const revoked = await createInvite(manager.token)
        const expired = await createInvite(manager.token)

        await api().delete(`/invites/${revoked.id}`).set(...auth(manager.token))
        await prisma.invite.update({where: {id: expired.id}, data: {expiresAt: new Date(Date.now() - 1000)}})

        for (const token of [revoked.token, expired.token]) {
            expect((await api().get(`/invites/${token}`)).status).toBe(404)
            const signup = await api().post("/users").send({name: "Pessoa", email: `p-${token.slice(0, 5)}@teste.com`, password: "123456", inviteToken: token})
            expect(signup.status).toBe(400)
        }

        const list = await api().get("/invites").set(...auth(manager.token))
        expect(list.body).toHaveLength(0)
    })

    it("funcionário não gera convite", async () => {
        const employee = await createUser("employee")

        const response = await api().post("/invites").set(...auth(employee.token)).send({})

        expect(response.status).toBe(403)
    })
})

describe("isolamento entre empresas", () => {
    async function twoCompanies() {
        const managerA = await createUser("manager")
        const employeeA = await createUser("employee")
        const otherOrg = await createOrganization("Empresa B")
        const managerB = await createUser("manager", otherOrg.id)
        const {body: refundA} = await createRefund(employeeA.token)
        const inviteA = await createInvite(managerA.token)

        return {managerA, employeeA, managerB, refundA, inviteA}
    }

    it("gestor de outra empresa não vê, não abre e não analisa os pedidos", async () => {
        const {managerB, refundA} = await twoCompanies()

        const list = await api().get("/refunds").set(...auth(managerB.token))
        const show = await api().get(`/refunds/${refundA.id}`).set(...auth(managerB.token))
        const approve = await api().patch(`/refunds/${refundA.id}/approve`).set(...auth(managerB.token))
        const receipt = await api().get(`/uploads/${refundA.filename}`).set(...auth(managerB.token))

        expect(list.body.pagination.totalRecords).toBe(0)
        expect(show.status).toBe(404)
        expect(approve.status).toBe(404)
        expect(receipt.status).toBe(404)
        expect((await prisma.refunds.findUnique({where: {id: refundA.id}}))?.status).toBe("pending")
    })

    it("equipe e convites ficam separados por empresa", async () => {
        const {managerB, inviteA} = await twoCompanies()

        const team = await api().get("/users").set(...auth(managerB.token))
        const invites = await api().get("/invites").set(...auth(managerB.token))
        const revoke = await api().delete(`/invites/${inviteA.id}`).set(...auth(managerB.token))

        expect(team.body.map((u: {email: string}) => u.email)).toEqual([managerB.user.email])
        expect(invites.body).toHaveLength(0)
        expect(revoke.status).toBe(404)
    })

    it("pedido criado fica na empresa de quem pediu", async () => {
        const {employeeA, refundA} = await twoCompanies()

        const stored = await prisma.refunds.findUnique({where: {id: refundA.id}})

        expect(stored?.organizationId).toBe(employeeA.user.organizationId)
    })
})
