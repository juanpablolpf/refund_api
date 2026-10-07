import { Request, Response } from "express"
import { z } from "zod"
import { prisma } from "@/database/prisma"
import { authUser } from "@/utils/auth-user"
import { ensureEmailIsFree, personSchema } from "@/utils/user-schemas"
import { hashPassword } from "@/utils/password"

const organizationNameSchema = z.string().trim().min(2, {message: "Informe o nome da empresa"}).max(80)

class OrganizationsController {
    // Cadastro público: cria a empresa e a primeira pessoa, que já entra como gestor
    async create(request: Request, response: Response) {
        const bodySchema = personSchema.extend({organizationName: organizationNameSchema})

        const {organizationName, name, email, password} = bodySchema.parse(request.body)

        await ensureEmailIsFree(email)

        const organization = await prisma.organization.create({
            data: {
                name: organizationName,
                users: {
                    create: {name, email, password: await hashPassword(password), role: "manager"},
                },
            },
            select: {id: true, name: true},
        })

        response.status(201).json(organization)
    }

    async show(request: Request, response: Response) {
        const {organizationId} = authUser(request)

        const organization = await prisma.organization.findUniqueOrThrow({
            where: {id: organizationId},
            select: {id: true, name: true, createdAt: true},
        })

        response.json(organization)
    }

    async update(request: Request, response: Response) {
        const {organizationId} = authUser(request)

        const {name} = z.object({name: organizationNameSchema}).parse(request.body)

        const organization = await prisma.organization.update({
            where: {id: organizationId},
            data: {name},
            select: {id: true, name: true},
        })

        response.json(organization)
    }
}

export {OrganizationsController}
