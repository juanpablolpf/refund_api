import { Request, Response } from "express"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { prisma } from "@/database/prisma"
import { authUser } from "@/utils/auth-user"
import { formatDateBR, monthRange } from "@/utils/period"

const CATEGORY_NAMES = {
    food: "Alimentação",
    transport: "Transporte",
    accommodation: "Hospedagem",
    services: "Serviços",
    others: "Outros",
} as const

const STATUS_NAMES = { pending: "Em análise", approved: "Aprovado", rejected: "Recusado" } as const

const PERIODS = {
    "this-month": () => monthRange(0),
    "last-month": () => monthRange(-1),
    all: () => null,
} as const

const exportQuerySchema = z.object({
    period: z.enum(["this-month", "last-month", "all"]).default("this-month"),
    status: z.enum(["pending", "approved", "rejected"]).optional(),
    name: z.string().trim().optional().default(""),
})

// Valor em reais com vírgula, como o Excel em português espera
function centsToBRL(cents: number) {
    return (cents / 100).toFixed(2).replace(".", ",")
}

// Uma célula de CSV: entre aspas, e sem deixar o Excel executar fórmulas (=, +, -, @ no começo)
function cell(value: string | number | null | undefined) {
    let text = value === null || value === undefined ? "" : String(value)
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
}

class RefundsReportsController {
    // Números do topo do painel do gestor
    async summary(request: Request, response: Response) {
        const { organizationId } = authUser(request)
        const { start, end } = monthRange(0)
        const thisMonth = { reviewedAt: { gte: start, lt: end } }

        const [pending, approved, rejected] = await Promise.all([
            prisma.refunds.aggregate({ where: { organizationId, status: "pending" }, _count: true, _sum: { amountInCents: true } }),
            prisma.refunds.aggregate({ where: { organizationId, status: "approved", ...thisMonth }, _count: true, _sum: { amountInCents: true } }),
            prisma.refunds.aggregate({ where: { organizationId, status: "rejected", ...thisMonth }, _count: true, _sum: { amountInCents: true } }),
        ])

        const totals = (result: typeof pending) => ({ count: result._count, amountInCents: result._sum.amountInCents ?? 0 })

        response.json({
            pending: totals(pending),
            approvedThisMonth: totals(approved),
            rejectedThisMonth: totals(rejected),
            month: { start, end },
        })
    }

    // Planilha (CSV) para o financeiro, com os mesmos filtros da lista + período
    async export(request: Request, response: Response) {
        const { organizationId } = authUser(request)
        const { period, status, name } = exportQuerySchema.parse(request.query)
        const range = PERIODS[period]()

        const where: Prisma.RefundsWhereInput = {
            organizationId,
            status,
            user: { name: { contains: name, mode: "insensitive" } },
            ...(range && { createdAt: { gte: range.start, lt: range.end } }),
        }

        const refunds = await prisma.refunds.findMany({
            where,
            orderBy: { createdAt: "asc" },
            include: { user: { select: { name: true, email: true } }, reviewedBy: { select: { name: true } } },
        })

        const header = ["Data do pedido", "Funcionário", "E-mail", "Descrição", "Categoria", "Valor (R$)", "Situação", "Analisado por", "Data da análise", "Motivo da recusa"]
        const rows = refunds.map((refund) => [
            formatDateBR(refund.createdAt),
            refund.user.name,
            refund.user.email,
            refund.name,
            CATEGORY_NAMES[refund.category],
            centsToBRL(refund.amountInCents),
            STATUS_NAMES[refund.status],
            refund.reviewedBy?.name,
            refund.reviewedAt && formatDateBR(refund.reviewedAt),
            refund.rejectionReason,
        ])

        // ";" separa colunas no Excel em português; o BOM faz ele ler os acentos certo
        const csv = "﻿" + [header, ...rows].map((row) => row.map(cell).join(";")).join("\r\n") + "\r\n"

        response.setHeader("Content-Type", "text/csv; charset=utf-8")
        response.setHeader("Content-Disposition", `attachment; filename="reembolsos-${period}.csv"`)
        response.send(csv)
    }
}

export { RefundsReportsController }
