import { Request, Response } from "express";
import {z} from "zod"
import {prisma} from "@/database/prisma"
import { AppError } from "@/utils/AppError";

const CategoriesEnum = z.enum(["food", "others", "services", "transport", "accommodation"])

// Dados do usuário que podem sair na resposta (nunca a senha)
const userPublicFields = {
    select: {id: true, name: true, email: true, role: true},
}

class RefundsController {
    async create (request: Request, response: Response) {
        const bodySchema = z.object({
            name: z.string().trim().min(1, {message: "Informe io nome da solicitação"}),
            category: CategoriesEnum,
            amount: z.number().positive({message: "O valor precisa ser positivo"}),
            filename: z.string().min(20),
        })

        const {name, category, amount, filename} = bodySchema.parse(request.body)

        if (!request.user?.id) {
            throw new AppError("Unauthorized", 401)
        }

        const refund = await prisma.refunds.create({
            data: {
                name,
                category,
                amount,
                filename,
                userId: request.user.id,
            },
        })

        response.status(201).json(refund)
    }

    async index(request: Request, response: Response) {
        const querySchema = z.object({
            name: z.string().optional().default(""),
            page: z.coerce.number().int().min(1).optional().default(1),
            perPage: z.coerce.number().int().min(1).max(50).optional().default(10),
        })

        const {name, page, perPage} = querySchema.parse(request.query)

        //Calcular os valores do skip
        const skip = (page - 1) * perPage

        const refunds = await prisma.refunds.findMany({
            skip,
            take: perPage,
            where: {
                user: {
                    name: {
                        contains: name.trim(),
                    },
                },
            },
            orderBy: {createdAt: "desc"},
            include: {user: userPublicFields},
        })

        // Obter o total de registrs para calcular o numero de paginas.
        const totalRecords = await prisma.refunds.count({
            where: {
            user: {
                name: {
                    contains: name.trim(),
                },
            },
        },
        })

        const totalPages = Math.ceil(totalRecords / perPage)

        response.json({
            refunds,
            pagination: {
                page,
                perPage,
                totalRecords,
                totalPagess: totalPages > 0 ? totalPages : 1,
            }
        })
    }

    async show(request: Request, response: Response) {
        const paramsSchema = z.object({
            id: z.string().uuid(),
        })

        const {id} = paramsSchema.parse(request.params)

        const refund = await prisma.refunds.findUnique({
            where: {id},
            include: {user: userPublicFields},
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
}

export {RefundsController}