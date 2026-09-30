import multer from "multer";
import path from "node:path"
import crypto from "node:crypto"

// Relativo à raiz do projeto (onde o npm roda), igual em dev (src/) e no build (build/)
const TMP_FOLDER = path.resolve(process.cwd(), "tmp")
const UPLOADS_FOLDER = path.resolve(TMP_FOLDER, "uploads")

const MAX_SIZE = 3
const MAX_FILE_SIZE = 1024 * 1024 * 3 // 3mb
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"]

const MULTER: multer.Options = {
    storage: multer.diskStorage({
        destination: TMP_FOLDER,
        filename(request, file, callback) {
            const fileHash = crypto.randomBytes(10).toString("hex")
            // Mantém só letras, números, ponto, hífen e _ do nome original
            const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_")
            const fileName = `${fileHash}-${safeName}`

            return callback(null, fileName)
        },
    }),
    // Recusa o arquivo durante o envio, antes de gravar tudo no disco
    limits: {fileSize: MAX_FILE_SIZE, files: 1},
}

export default{
    TMP_FOLDER,
    UPLOADS_FOLDER,
    MULTER,
    MAX_FILE_SIZE,
    ACCEPTED_IMAGE_TYPES,
    MAX_SIZE,
}