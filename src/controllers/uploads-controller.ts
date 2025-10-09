import { Request, Response } from "express"
import z from "zod"
import uploadConfig from "@/configs/upload"

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
                        `Arquivo excede o tamanho máximo de ${uploadConfig.MAX_SIZE}` 
                    ),
            })
            .passthrough()

            const {file} = fileSchema.parse(request.file)
            
            response.json({message: "ok"})

        } catch (error) {
            throw error
        }
    }
}

export {UploadsController}