import "express-async-errors"
import express from "express"
import cors from "cors"
import { env } from "./env"
import { errorHandling } from "./middlewares/error-handling"
import { routes } from "./routes"

const app = express()
app.use(cors(env.CORS_ORIGIN ? { origin: env.CORS_ORIGIN } : undefined))
app.use(express.json())

// Usado pelo Render para saber se a API está no ar
app.get("/health", (request, response) => {
    response.json({ status: "ok" })
})

app.use(routes)

app.use(errorHandling)

export { app }
