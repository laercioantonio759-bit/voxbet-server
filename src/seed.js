require("dotenv").config();
const { readDb, writeDb } = require("./db");
const { hashPassword } = require("./auth");
const { id, now } = require("./utils");

(async () => {
  const db = await readDb();

  if (!db.users.find(u => u.email === "admin@voxbet.local")) {
    const admin = {
      id: id("usr"),
      name: "VoxBet Admin",
      email: "admin@voxbet.local",
      phone: "+244900000000",
      passwordHash: await hashPassword("Admin@123"),
      role: "ADMIN",
      status: "ACTIVE",
      kycStatus: "VERIFIED",
      createdAt: now()
    };

    db.users.push(admin);
    db.wallets.push({
      id: id("wal"),
      userId: admin.id,
      balance: 0,
      currency: "VCOIN",
      updatedAt: now()
    });
  }

  await writeDb(db);
  console.log("Seed concluído.");
  console.log("Admin: admin@voxbet.local");
  console.log("Senha: Admin@123");
})().catch(err => {
  console.error(err);
  process.exit(1);
});