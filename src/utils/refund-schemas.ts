import { z } from "zod"

export const categorySchema = z.enum(["food", "others", "services", "transport", "accommodation"])
export const statusSchema = z.enum(["pending", "approved", "rejected"])
