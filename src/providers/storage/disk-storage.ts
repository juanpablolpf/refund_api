import fs from "node:fs"
import path from "node:path"
import { Response } from "express"
import uploadConfig from "@/configs/upload"
import { StorageProvider } from "./storage-provider"

// Guarda os comprovantes em tmp/uploads. Usado em desenvolvimento e nos testes.
export class DiskStorage implements StorageProvider {
    private filePath(filename: string) {
        return path.resolve(uploadConfig.UPLOADS_FOLDER, filename)
    }

    async save(filename: string) {
        await fs.promises.mkdir(uploadConfig.UPLOADS_FOLDER, {recursive: true})
        await fs.promises.rename(path.resolve(uploadConfig.TMP_FOLDER, filename), this.filePath(filename))
    }

    async exists(filename: string) {
        try {
            await fs.promises.access(this.filePath(filename))
            return true
        } catch {
            return false
        }
    }

    async delete(filename: string) {
        await fs.promises.rm(this.filePath(filename), {force: true})
    }

    async send(filename: string, response: Response) {
        if (!(await this.exists(filename))) {
            response.status(404).json({message: "Arquivo não encontrado"})
            return
        }

        response.sendFile(this.filePath(filename))
    }
}
