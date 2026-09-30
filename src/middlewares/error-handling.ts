import { AppError } from "@/utils/AppError";
import { ErrorRequestHandler } from "express";
import { MulterError } from "multer";
import uploadConfig from "@/configs/upload"
import {ZodError} from "zod"

export const errorHandling: ErrorRequestHandler = (
    error,
    request,
    response,
    next
) => {
    if (error instanceof AppError) {
        response.status(error.statusCode).json({message: error.message})
        return 
    }

    if (error instanceof ZodError) {
        response.status(400).json({
            message: "validation error",
            issues: error.format()
        })
        return
    }

    if (error instanceof MulterError) {
        const message = error.code === "LIMIT_FILE_SIZE"
            ? `Arquivo excede o tamanho máximo de ${uploadConfig.MAX_SIZE}MB`
            : "Envio de arquivo inválido"

        response.status(400).json({message})
        return
    }

    // Detalhes do erro ficam só no log do servidor
    console.error(error)
    response.status(500).json({message: "Erro interno do servidor"})
}
