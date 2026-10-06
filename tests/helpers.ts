import request from "supertest"
import { hash } from "bcrypt"
import { UserRole } from "@prisma/client"
import { app } from "@/app"
import { prisma } from "@/database/prisma"

export const api = () => request(app)

// Empresa padrão de cada teste (recriada no resetDatabase)
let defaultOrganizationId = ""

export async function resetDatabase() {
    await prisma.invite.deleteMany()
    await prisma.refunds.deleteMany()
    await prisma.user.deleteMany()
    await prisma.organization.deleteMany()

    defaultOrganizationId = (await createOrganization("Empresa Teste")).id
}

export function createOrganization(name: string) {
    return prisma.organization.create({data: {name}})
}

let userCount = 0

// Cria o usuário direto no banco e faz login pela API
export async function createUser(role: UserRole = "employee", organizationId = defaultOrganizationId) {
    userCount++
    const email = `${role}${userCount}@teste.com`
    const password = "123456"

    const user = await prisma.user.create({
        data: {name: `${role} ${userCount}`, email, password: await hash(password, 4), role, organizationId},
    })

    const response = await api().post("/sessions").send({email, password})

    return {user, token: response.body.token as string}
}

export async function createInvite(managerToken: string, role: UserRole = "employee") {
    const response = await api()
        .post("/invites")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({role})

    return response.body as {id: string; token: string; role: UserRole}
}

export async function uploadReceipt(token: string) {
    const response = await api()
        .post("/uploads")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("imagem de teste"), {filename: "comprovante.jpg", contentType: "image/jpeg"})

    return response.body.filename as string
}

export async function createRefund(token: string, data: Record<string, unknown> = {}) {
    const filename = await uploadReceipt(token)

    return api()
        .post("/refunds")
        .set("Authorization", `Bearer ${token}`)
        .send({name: "Almoço", category: "food", amountInCents: 3550, filename, ...data})
}
