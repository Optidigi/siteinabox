import { readBoundedJSON } from "@/lib/http/body"

export const readBuilderJSON = (req: Request): Promise<unknown> => readBoundedJSON(req, 64 * 1024, 5000)
