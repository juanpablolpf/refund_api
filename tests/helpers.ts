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

// Começos de arquivo que a API reconhece como JPG, PNG e PDF
export const FILES = {
    jpg: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("resto da foto")]),
    png: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("resto")]),
    pdf: Buffer.from("%PDF-1.4 nota fiscal de teste"),
}

export function upload(token: string, content = FILES.jpg, filename = "comprovante.jpg", contentType = "image/jpeg") {
    return api()
        .post("/uploads")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", content, {filename, contentType})
}

export async function uploadReceipt(token: string) {
    const response = await upload(token)
    return response.body.filename as string
}

export async function createRefund(token: string, data: Record<string, unknown> = {}) {
    const filename = await uploadReceipt(token)

    return api()
        .post("/refunds")
        .set("Authorization", `Bearer ${token}`)
        .send({name: "Almoço", category: "food", amountInCents: 3550, filename, ...data})
}
