import { UserRole } from "@prisma/client"
import { Request, Response } from "express"
import {z} from "zod"

class UsersController {
    async create(request: Request, response: Response) {
        const bodySchema = z.object({
            name: z.string(). trim().min(2, {message: "Nome é obrigatório"}),
            email: z.string().trim().email({message: "E-mail inválido"}).toLowerCase(),
            password: z.string().min(6, {message: "A senha deve ter pelo menos 6 dígitos"}),
            role: z.enum([UserRole.employee, UserRole.manager]).default(UserRole.employee)
        })

        const {name, email, password, role} = bodySchema.parse(request.body) 

        response.json({name, email, password, role})
    }
}

export {UsersController}