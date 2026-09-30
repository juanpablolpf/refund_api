import { Request, Response } from "express"
import z from "zod"
import path from "node:path"
import {prisma} from "@/database/prisma"

import uploadConfig from "@/configs/upload"
import { DiskStorage } from "@/providers/disk-storage"

import { ZodError } from "zod"
import { AppError } from "@/utils/AppError"

class UploadsController {
    async create (request: Request, response: Response) {
        const diskStorage = new DiskStorage()
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
            const filename = await diskStorage.saveFile(file.filename)
            
            response.json({filename})

        } catch (error) {
            if(error instanceof ZodError){
                if(request.file){
                    await diskStorage.deleteFile(request.file.filename, "tmp")
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

        const refund = await prisma.refunds.findFirst({where: {filename}})

        const isOwner = refund?.userId === request.user?.id
        const isManager = request.user?.role === "manager"

        if (!refund || (!isOwner && !isManager)) {
            throw new AppError("Arquivo não encontrado", 404)
        }

        response.sendFile(path.resolve(uploadConfig.UPLOADS_FOLDER, filename), (error) => {
            if (error && !response.headersSent) {
                response.status(404).json({message: "Arquivo não encontrado"})
            }
        })
    }
}

export {UploadsController}