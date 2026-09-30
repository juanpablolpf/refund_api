import { Response } from "express"

// Os comprovantes chegam primeiro em tmp/ (multer) e depois vão para o armazenamento definitivo
export interface StorageProvider {
    // Move o arquivo de tmp/ para o armazenamento definitivo
    save(filename: string): Promise<void>
    exists(filename: string): Promise<boolean>
    delete(filename: string): Promise<void>
    // Envia o arquivo como resposta HTTP
    send(filename: string, response: Response): Promise<void>
}
