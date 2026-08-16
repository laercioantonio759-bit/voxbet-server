const fs = require("fs/promises");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "db.json");

const defaultDb = {
  users: [],
  wallets: [],
  bets: [],
  transactions: [],
  notifications: [],
  otp: [],
  kyc: [],
  deposits: [],
  withdrawals: [],
  sync: {
    lastFixturesSync: null,
    lastLiveSync: null
  }
};

async function ensureDb() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await writeDb(defaultDb);
  }
}

async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeDb(data) {
  const tempPath = `${DB_PATH}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tempPath, DB_PATH);
}

async function updateDb(mutator) {
  const db = await readDb();
  const result = await mutator(db);
  await writeDb(db);
  return result;
}

module.exports = { readDb, writeDb, updateDb, ensureDb };