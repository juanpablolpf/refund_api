import multer from "multer"
import path from "node:path"
import crypto from "node:crypto"

// Relativo à raiz do projeto (onde o npm roda), igual em dev (src/) e no build (build/)
const TMP_FOLDER = path.resolve(process.cwd(), "tmp")
const UPLOADS_FOLDER = path.resolve(TMP_FOLDER, "uploads")

const MAX_SIZE_MB = 3

// Nome que o multer dá ao arquivo: 20 caracteres hex + "-" + nome original limpo
const RECEIPT_FILENAME = /^[a-f0-9]{20}-[a-zA-Z0-9._-]+$/

const MULTER: multer.Options = {
    storage: multer.diskStorage({
        destination: TMP_FOLDER,
        filename(request, file, callback) {
            const fileHash = crypto.randomBytes(10).toString("hex")
            const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_")

            callback(null, `${fileHash}-${safeName}`)
        },
    }),
    // Recusa o arquivo durante o envio, antes de gravar tudo no disco
    limits: { fileSize: MAX_SIZE_MB * 1024 * 1024, files: 1 },
}

export default {
    TMP_FOLDER,
    UPLOADS_FOLDER,
    MULTER,
    MAX_SIZE_MB,
    RECEIPT_FILENAME,
}
