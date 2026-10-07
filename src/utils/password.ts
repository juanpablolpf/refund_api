import { compare, hash } from "bcrypt"

const HASH_ROUNDS = 8

export function hashPassword(password: string) {
    return hash(password, HASH_ROUNDS)
}

export function passwordMatches(password: string, hashed: string) {
    return compare(password, hashed)
}
