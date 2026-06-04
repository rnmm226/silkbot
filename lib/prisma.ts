import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/prisma/client";

const adapter = new PrismaMariaDb({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "secret123",
  database: "monapp",
  connectionLimit: 5,
});
export const prisma = new PrismaClient({ adapter });
export default prisma;
