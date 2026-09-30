import fs from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import { Response } from "express"
import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    NotFound,
    NoSuchKey,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3"
import uploadConfig from "@/configs/upload"
import { env } from "@/env"
import { StorageProvider } from "./storage-provider"

const CONTENT_TYPES: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
}

// Guarda os comprovantes num bucket compatível com S3 (Supabase Storage, Cloudflare R2, AWS S3...)
export class S3Storage implements StorageProvider {
    private bucket = env.S3_BUCKET!

    private client = new S3Client({
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        forcePathStyle: true,
        credentials: {
            accessKeyId: env.S3_ACCESS_KEY_ID!,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
        },
    })

    async save(filename: string) {
        const tmpPath = path.resolve(uploadConfig.TMP_FOLDER, filename)
        const contentType = CONTENT_TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream"

        try {
            await this.client.send(new PutObjectCommand({
                Bucket: this.bucket,
                Key: filename,
                Body: await fs.promises.readFile(tmpPath),
                ContentType: contentType,
            }))
        } finally {
            await fs.promises.rm(tmpPath, {force: true})
        }
    }

    async exists(filename: string) {
        try {
            await this.client.send(new HeadObjectCommand({Bucket: this.bucket, Key: filename}))
            return true
        } catch (error) {
            if (error instanceof NotFound || error instanceof NoSuchKey) return false
            throw error
        }
    }

    async delete(filename: string) {
        await this.client.send(new DeleteObjectCommand({Bucket: this.bucket, Key: filename}))
    }

    async send(filename: string, response: Response) {
        try {
            const object = await this.client.send(new GetObjectCommand({Bucket: this.bucket, Key: filename}))

            response.setHeader("Content-Type", object.ContentType ?? "application/octet-stream")
            ;(object.Body as Readable).pipe(response)
        } catch (error) {
            if (error instanceof NoSuchKey) {
                response.status(404).json({message: "Arquivo não encontrado"})
                return
            }
            throw error
        }
    }
}
