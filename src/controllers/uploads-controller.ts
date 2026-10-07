import { Request, Response } from "express"
import { z } from "zod"
import fs from "node:fs"
import path from "node:path"
import { prisma } from "@/database/prisma"
import uploadConfig from "@/configs/upload"
import { storage } from "@/providers/storage"
import { AppError } from "@/utils/AppError"
import { authUser } from "@/utils/auth-user"
import { detectReceiptType } from "@/utils/file-type"

class UploadsController {
    // O tamanho já foi limitado pelo multer; aqui o tipo é conferido pelo conteúdo do arquivo
    async create(request: Request, response: Response) {
        if (!request.file) {
            throw new AppError("Arquivo é obrigatório")
        }

        const tmpPath = path.resolve(uploadConfig.TMP_FOLDER, request.file.filename)
        const type = await detectReceiptType(tmpPath)

        if (!type) {
            await fs.promises.rm(tmpPath, { force: true })
            throw new AppError("Envie uma foto (JPG ou PNG) ou um PDF")
        }

        // A extensão do arquivo salvo segue o conteúdo real (ela define o tipo na hora de abrir)
        const original = request.file.filename
        const dot = original.lastIndexOf(".")
        const filename = `${dot > 20 ? original.slice(0, dot) : original}${type.ext}`

        if (filename !== original) {
            await fs.promises.rename(tmpPath, path.resolve(uploadConfig.TMP_FOLDER, filename))
        }

        await storage.save(filename)

        response.json({ filename })
    }

    async show(request: Request, response: Response) {
        const result = z.object({ filename: z.string().regex(uploadConfig.RECEIPT_FILENAME) }).safeParse(request.params)

        if (!result.success) {
            throw new AppError("Arquivo não encontrado", 404)
        }

        const { filename } = result.data
        const user = authUser(request)
        const refund = await prisma.refunds.findFirst({ where: { filename, organizationId: user.organizationId } })

        const isOwner = refund?.userId === user.id
        const isManager = user.role === "manager"

        if (!refund || (!isOwner && !isManager)) {
            throw new AppError("Arquivo não encontrado", 404)
        }

        // O navegador usa o tipo enviado, sem tentar adivinhar pelo conteúdo, e abre o arquivo na própria aba
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Disposition", "inline")

        await storage.send(filename, response)
    }
}

export { UploadsController }
