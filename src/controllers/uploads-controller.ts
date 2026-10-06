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

class UploadsController {
    async create (request: Request, response: Response) {
        try {
           const fileSchema = z.object({
                filename: z.string().min(1, "Arquivo é obrigatório"),
                mimetype: z
                    .string()
                    .refine(
                        (type) => uploadConfig.ACCEPTED_IMAGE_TYPES.includes(type),
                        `Formato de arquivo inválido. Formatos permitidos: ${uploadConfig.ACCEPTED_IMAGE_TYPES}`
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
            await storage.save(file.filename)

            response.json({filename: file.filename})

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

        await storage.send(filename, response)
    }
}

export {UploadsController}