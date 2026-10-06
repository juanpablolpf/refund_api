import { Request, Response } from "express"
import z from "zod"
import fs from "node:fs"
import path from "node:path"
import {prisma} from "@/database/prisma"

import uploadConfig from "@/configs/upload"
import { storage } from "@/providers/storage"

import { ZodError } from "zod"
import { AppError } from "@/utils/AppError"
import { authUser } from "@/utils/auth-user"
import { detectReceiptType } from "@/utils/file-type"

const INVALID_TYPE = "Envie uma foto (JPG ou PNG) ou um PDF"

class UploadsController {
    async create (request: Request, response: Response) {
        try {
           const fileSchema = z.object({
                filename: z.string().min(1, "Arquivo é obrigatório"),
                mimetype: z
                    .string()
                    .refine(
                        (type) => uploadConfig.ACCEPTED_TYPES.includes(type),
                        INVALID_TYPE
                ),
                size: z
                    .number()
                    .positive()
                    .refine(
                        (size) => size <= uploadConfig.MAX_FILE_SIZE,
                        `Arquivo excede o tamanho máximo de ${uploadConfig.MAX_SIZE}MB`
                    ),
            })
            .passthrough()

            const file = fileSchema.parse(request.file)
            const tmpPath = path.resolve(uploadConfig.TMP_FOLDER, file.filename)

            const type = await detectReceiptType(tmpPath)

            if (!type) {
                await fs.promises.rm(tmpPath, {force: true})
                throw new AppError(INVALID_TYPE)
            }

            // A extensão do arquivo salvo segue o conteúdo real (ela define o tipo na hora de abrir)
            const dot = file.filename.lastIndexOf(".")
            const baseName = dot > 20 ? file.filename.slice(0, dot) : file.filename
            const filename = `${baseName}${type.ext}`

            if (filename !== file.filename) {
                await fs.promises.rename(tmpPath, path.resolve(uploadConfig.TMP_FOLDER, filename))
            }

            await storage.save(filename)

            response.json({filename})

        } catch (error) {
            if(error instanceof ZodError){
                if(request.file){
                    await fs.promises.rm(path.resolve(uploadConfig.TMP_FOLDER, request.file.filename), {force: true})
                }

                throw new AppError(error.issues[0].message)
            }
            throw error
        }
    }

    async show(request: Request, response: Response) {
        const paramsSchema = z.object({
            filename: z.string().regex(/^[a-f0-9]{20}-[a-zA-Z0-9._-]+$/),
        })

        const result = paramsSchema.safeParse(request.params)

        if (!result.success) {
            throw new AppError("Arquivo não encontrado", 404)
        }

        const {filename} = result.data

        const user = authUser(request)
        const refund = await prisma.refunds.findFirst({where: {filename, organizationId: user.organizationId}})

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

export {UploadsController}