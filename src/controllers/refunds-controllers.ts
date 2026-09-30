import { Request, Response } from "express";
import {z} from "zod"
import { Prisma } from "@prisma/client";
import {prisma} from "@/database/prisma"
import { AppError } from "@/utils/AppError";
import { storage } from "@/providers/storage";

const CategoriesEnum = z.enum(["food", "others", "services", "transport", "accommodation"])
const StatusEnum = z.enum(["pending", "approved", "rejected"])

// Dados do usuário que podem sair na resposta (nunca a senha)
const userPublicFields = {
    select: {id: true, name: true, email: true, role: true},
}

const paginationSchema = z.object({
    status: StatusEnum.optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    perPage: z.coerce.number().int().min(1).max(50).optional().default(10),
})

const paramsSchema = z.object({
    id: z.string().uuid(),
})

async function paginate(where: Prisma.RefundsWhereInput, page: number, perPage: number) {
    const [refunds, totalRecords] = await Promise.all([
        prisma.refunds.findMany({
            skip: (page - 1) * perPage,
            take: perPage,
            where,
            orderBy: {createdAt: "desc"},
            include: {user: userPublicFields},
        }),
        prisma.refunds.count({where}),
    ])

    const totalPages = Math.ceil(totalRecords / perPage)

    return {
        refunds,
        pagination: {
            page,
            perPage,
            totalRecords,
            totalPages: totalPages > 0 ? totalPages : 1,
        },
    }
}

// Aprova ou recusa só se o pedido ainda estiver pendente. O filtro por status
// no próprio update evita que dois gestores analisem o mesmo pedido ao mesmo tempo.
async function review(id: string, reviewerId: string, data: Prisma.RefundsUpdateManyMutationInput) {
    const {count} = await prisma.refunds.updateMany({
        where: {id, status: "pending"},
        data: {...data, reviewedById: reviewerId, reviewedAt: new Date()},
    })

    if (count === 0) {
        const exists = await prisma.refunds.findUnique({where: {id}, select: {id: true}})

        if (!exists) {
            throw new AppError("Solicitação não encontrada", 404)
        }

        throw new AppError("Essa solicitação já foi analisada", 409)
    }

    return prisma.refunds.findUnique({
        where: {id},
        include: {user: userPublicFields, reviewedBy: userPublicFields},
    })
}

class RefundsController {
    async create (request: Request, response: Response) {
        const bodySchema = z.object({
            name: z.string().trim().min(1, {message: "Informe o nome da solicitação"}),
            category: CategoriesEnum,
            amountInCents: z
                .number()
                .int({message: "Informe o valor em centavos (ex.: R$ 35,50 = 3550)"})
                .positive({message: "O valor precisa ser positivo"}),
            filename: z.string().regex(/^[a-f0-9]{20}-[a-zA-Z0-9._-]+$/, {message: "Arquivo inválido"}),
        })

        const {name, category, amountInCents, filename} = bodySchema.parse(request.body)

        if (!request.user?.id) {
            throw new AppError("Unauthorized", 401)
        }

        // O comprovante precisa ter sido enviado por /uploads e não pode estar em outro pedido
        if (!(await storage.exists(filename))) {
            throw new AppError("Comprovante não encontrado. Envie o arquivo antes de criar a solicitação")
        }

        const fileInUse = await prisma.refunds.findFirst({where: {filename}, select: {id: true}})

        if (fileInUse) {
            throw new AppError("Esse comprovante já está em outra solicitação")
        }

        const refund = await prisma.refunds.create({
            data: {
                name,
                category,
                amountInCents,
                filename,
                userId: request.user.id,
            },
        })

        response.status(201).json(refund)
    }

    // Gestor: todos os pedidos, com filtro por nome do funcionário e status
    async index(request: Request, response: Response) {
        const querySchema = paginationSchema.extend({
            name: z.string().trim().optional().default(""),
        })

        const {name, status, page, perPage} = querySchema.parse(request.query)

        const result = await paginate(
            {user: {name: {contains: name, mode: "insensitive"}}, status},
            page,
            perPage
        )

        response.json(result)
    }

    // Funcionário: só os próprios pedidos
    async mine(request: Request, response: Response) {
        const {status, page, perPage} = paginationSchema.parse(request.query)

        const result = await paginate({userId: request.user?.id, status}, page, perPage)

        response.json(result)
    }

    async show(request: Request, response: Response) {
        const {id} = paramsSchema.parse(request.params)

        const refund = await prisma.refunds.findUnique({
            where: {id},
            include: {user: userPublicFields, reviewedBy: userPublicFields},
        })

        // Funcionário só enxerga os próprios pedidos. Responde 404 (e não 403)
        // para não revelar que o id existe.
        const isOwner = refund?.userId === request.user?.id
        const isManager = request.user?.role === "manager"

        if (!refund || (!isOwner && !isManager)) {
            throw new AppError("Solicitação não encontrada", 404)
        }

        response.json(refund)
    }

    async approve(request: Request, response: Response) {
        const {id} = paramsSchema.parse(request.params)

        const refund = await review(id, request.user!.id, {
            status: "approved",
            rejectionReason: null,
        })

        response.json(refund)
    }

    async reject(request: Request, response: Response) {
        const {id} = paramsSchema.parse(request.params)

        const bodySchema = z.object({
            reason: z.string().trim().min(3, {message: "Informe o motivo da recusa"}),
        })

        const {reason} = bodySchema.parse(request.body)

        const refund = await review(id, request.user!.id, {
            status: "rejected",
            rejectionReason: reason,
        })

        response.json(refund)
    }

    // Funcionário cancela um pedido próprio que ainda não foi analisado
    async remove(request: Request, response: Response) {
        const {id} = paramsSchema.parse(request.params)

        const refund = await prisma.refunds.findUnique({where: {id}})

        if (!refund || refund.userId !== request.user?.id) {
            throw new AppError("Solicitação não encontrada", 404)
        }

        if (refund.status !== "pending") {
            throw new AppError("Só é possível cancelar solicitações pendentes", 409)
        }

        await prisma.refunds.delete({where: {id}})
        await storage.delete(refund.filename)

        response.status(204).send()
    }
}

export {RefundsController}
