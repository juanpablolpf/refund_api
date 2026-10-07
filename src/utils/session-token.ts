import { sign } from "jsonwebtoken"
import { authConfig } from "@/configs/auth"

type TokenUser = { id: string; role: string; organizationId: string; sessionVersion: number }

// Token de login. "v" é a versão da sessão: quando a senha muda, tokens com a versão antiga deixam de valer.
export function signSessionToken(user: TokenUser) {
    const { secret, expiresIn } = authConfig.jwt

    return sign({ role: user.role, org: user.organizationId, v: user.sessionVersion }, secret, {
        subject: user.id,
        expiresIn,
    })
}
