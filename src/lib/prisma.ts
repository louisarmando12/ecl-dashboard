import { PrismaClient } from '@prisma/client'

// Force instantiate a new client so it picks up the latest schema after db push
const prisma = new PrismaClient()

export default prisma
