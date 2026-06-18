import { prisma } from "@/lib/prisma"

async function seedAdmin() {
    // Vérifie d'abord que l'user existe
    const existing = await prisma.user.findUnique({
        where: { email: "rnmdridi9@gmail.com" }
    })
    console.log("User trouvé :", existing)

    // Update le role
    const user = await prisma.user.update({
        where: { email: "rnmdridi9@gmail.com" },
        data: { role: "admin" }
    })
    console.log("Après update :", user.role)
}

seedAdmin()