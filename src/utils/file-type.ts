import fs from "node:fs"

// Tipos de comprovante aceitos, reconhecidos pelos primeiros bytes do arquivo
// (o tipo informado pelo navegador pode ser falsificado)
const SIGNATURES = [
    { mime: "image/jpeg", ext: ".jpg", bytes: [0xff, 0xd8, 0xff] },
    { mime: "image/png", ext: ".png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    { mime: "application/pdf", ext: ".pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
] as const

export type ReceiptType = (typeof SIGNATURES)[number]

export async function detectReceiptType(filePath: string): Promise<ReceiptType | null> {
    const handle = await fs.promises.open(filePath, "r")

    try {
        const header = Buffer.alloc(8)
        await handle.read(header, 0, header.length, 0)

        return SIGNATURES.find((type) => type.bytes.every((byte, index) => header[index] === byte)) ?? null
    } finally {
        await handle.close()
    }
}

const CONTENT_TYPES: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".pdf": "application/pdf",
}

export function contentTypeFor(filename: string) {
    const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase()
    return CONTENT_TYPES[ext] ?? "application/octet-stream"
}
