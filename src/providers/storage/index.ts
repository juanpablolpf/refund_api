import { env } from "@/env"
import { DiskStorage } from "./disk-storage"
import { S3Storage } from "./s3-storage"
import { StorageProvider } from "./storage-provider"

export const storage: StorageProvider = env.STORAGE_DRIVER === "s3" ? new S3Storage() : new DiskStorage()
