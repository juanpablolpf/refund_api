import { Request, Response } from "express";

class RefundsController {
    async create (requeste: Request, response: Response) {
        response.json({message: "ok"})
    }
}

export {RefundsController}