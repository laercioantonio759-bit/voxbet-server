require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const bcrypt = require("bcryptjs");
const { Server } = require("socket.io");

const {
  readDb,
  updateDb,
  ensureDb
} = require("./db");

const {
  id,
  now,
  toNumber
} = require("./utils");

const {
  hashPassword,
  comparePassword,
  signUser,
  authRequired,
  adminRequired
} = require("./auth");

const sports = require("./sports");
const {
  paymentProvider,
  kycProvider,
  smsProvider,
  emailProvider
} = require("./providers");

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors({
  origin: process.env.FRONTEND_URL || "*"
}));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({
    name: "VoxBet Demo API",
    status: "online",
    mode: "DEMO / VIRTUAL CREDITS",
    warning: "Sem apostas monetárias reais neste exemplo."
  });
});

app.get("/api/health", async (req, res) => {
  const db = await readDb();
  res.json({
    status: "ok",
    database: "db.json",
    apiFootballConfigured: Boolean(process.env.API_FOOTBALL_KEY),
    users: db.users.length,
    timestamp: now()
  });
});

/* =========================
   AUTH
========================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const {
  name,
  email,
  phone,
  identificationNumber,
  password
} = req.body;

   if (
  !name ||
  !email ||
  !identificationNumber ||
  !password
) {
  return res.status(400).json({
    error: "Nome, email, número de identificação e senha são obrigatórios."
  });
}

    const result = await updateDb(async db => {
      const existing = db.users.find(
        u => u.email.toLowerCase() === String(email).toLowerCase()
      );

      if (existing) {
        throw Object.assign(new Error("Email já cadastrado."), { status: 409 });
      }

      const existingIdentification = db.users.find(
        u => u.identificationNumber === identificationNumber
      );

      if (existingIdentification) {
        throw Object.assign(
          new Error("Número de identificação já cadastrado."),
          { status: 409 }
        );
      }
      const passwordHash = await hashPassword(password);

      const user = {
        id: id("usr"),
        name,
        email: String(email).toLowerCase(),
        phone: phone || null,
        identificationNumber,
        passwordHash,
        role: "USER",
        status: "ACTIVE",
        kycStatus: "PENDING",
        createdAt: now()
      };

      const wallet = {
        id: id("wal"),
        userId: user.id,
        balance: 10000,
        currency: "VCOIN",
        updatedAt: now()
      };

      db.users.push(user);
      db.wallets.push(wallet);

      return { user, wallet };
    });

    const token = signUser(result.user);

    res.status(201).json({
      message: "Conta criada.",
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone,
        role: result.user.role
      },
      wallet: result.wallet
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const db = await readDb();
    const user = db.users.find(
      u => u.email === String(email || "").toLowerCase()
    );

    if (!user || !(await comparePassword(password || "", user.passwordHash))) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const token = signUser(user);
    const wallet = db.wallets.find(w => w.userId === user.id);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        kycStatus: user.kycStatus
      },
      wallet
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  const db = await readDb();
  const user = db.users.find(u => u.id === req.auth.sub);
  if (!user) return res.status(404).json({ error: "Utilizador não encontrado." });

  const wallet = db.wallets.find(w => w.userId === user.id);

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      kycStatus: user.kycStatus
    },
    wallet
  });
});

/* =========================
   SPORTS - API FOOTBALL
========================= */

app.get("/api/sports/countries", async (req, res) => {
  try {
    res.json(await sports.getCountries());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

app.get("/api/sports/leagues", async (req, res) => {
  try {
    res.json(await sports.getLeagues(req.query));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

app.get("/api/sports/fixtures", async (req, res) => {
  try {
    res.json(await sports.getFixtures(req.query));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

app.get("/api/sports/fixtures/:id", async (req, res) => {
  try {
    const data = await sports.getFixture(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

app.get("/api/sports/live", async (req, res) => {
  try {
    res.json(await sports.getLiveFixtures());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

app.get("/api/sports/odds", async (req, res) => {
  try {
    res.json(await sports.getOdds(req.query));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

app.get("/api/sports/odds/live", async (req, res) => {
  try {
    res.json(await sports.getLiveOdds(req.query));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

app.get("/api/sports/predictions/:fixture", async (req, res) => {
  try {
    res.json(await sports.getPrediction(req.params.fixture));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

app.get("/api/sports/standings", async (req, res) => {
  try {
    res.json(await sports.getStandings(req.query));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

app.get("/api/sports/statistics/:fixture", async (req, res) => {
  try {
    res.json(await sports.getStatistics({ fixture: req.params.fixture, team: req.query.team }));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

app.get("/api/sports/events/:fixture", async (req, res) => {
  try {
    res.json(await sports.getEvents(req.params.fixture));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

/* =========================
   WALLET VIRTUAL
========================= */

app.get("/api/wallet", authRequired, async (req, res) => {
  const db = await readDb();
  const wallet = db.wallets.find(w => w.userId === req.auth.sub);

  res.json(wallet || {
    userId: req.auth.sub,
    balance: 0,
    currency: "VCOIN"
  });
});

/* =========================
   DEMO PAYMENTS
========================= */

app.post("/api/payments/deposit", authRequired, async (req, res) => {
  try {
    const amount = toNumber(req.body.amount);

    if (amount <= 0) {
      return res.status(400).json({ error: "Valor deve ser maior que zero." });
    }

    const payment = await paymentProvider.createDeposit({
      userId: req.auth.sub,
      amount
    });

    const result = await updateDb(async db => {
      const wallet = db.wallets.find(w => w.userId === req.auth.sub);

      if (!wallet) {
        throw Object.assign(new Error("Carteira não encontrada."), { status: 404 });
      }

      wallet.balance += amount;
      wallet.updatedAt = now();

      const transaction = {
        id: id("txn"),
        userId: req.auth.sub,
        type: "DEMO_DEPOSIT",
        amount,
        status: "COMPLETED",
        reference: payment.externalId,
        currency: "VCOIN",
        createdAt: now()
      };

      db.transactions.push(transaction);
      db.deposits.push(payment);

      return { wallet, transaction };
    });

    res.json({
      message: "Depósito DEMO concluído.",
      warning: "Nenhum dinheiro real foi processado.",
      ...result
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post("/api/payments/withdraw", authRequired, async (req, res) => {
  try {
    const amount = toNumber(req.body.amount);
    const destination = req.body.destination || "DEMO_DESTINATION";

    const result = await updateDb(async db => {
      const wallet = db.wallets.find(w => w.userId === req.auth.sub);

      if (!wallet) {
        throw Object.assign(new Error("Carteira não encontrada."), { status: 404 });
      }

      if (amount <= 0 || amount > wallet.balance) {
        throw Object.assign(new Error("Saldo insuficiente ou valor inválido."), { status: 400 });
      }

      wallet.balance -= amount;
      wallet.updatedAt = now();

      const withdrawal = await paymentProvider.createWithdrawal({
        userId: req.auth.sub,
        amount,
        destination
      });

      const transaction = {
        id: id("txn"),
        userId: req.auth.sub,
        type: "DEMO_WITHDRAWAL",
        amount: -amount,
        status: "COMPLETED",
        reference: withdrawal.externalId,
        currency: "VCOIN",
        createdAt: now()
      };

      db.transactions.push(transaction);
      db.withdrawals.push(withdrawal);

      return { wallet, withdrawal, transaction };
    });

    res.json({
      message: "Levantamento DEMO processado.",
      warning: "Nenhum dinheiro real foi processado.",
      ...result
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* =========================
   KYC DEMO
========================= */

app.post("/api/kyc/verify", authRequired, async (req, res) => {
  try {
    const verification = await kycProvider.verify({ userId: req.auth.sub });

    const result = await updateDb(async db => {
      const user = db.users.find(u => u.id === req.auth.sub);
      if (!user) throw Object.assign(new Error("Utilizador não encontrado."), { status: 404 });

      user.kycStatus = verification.status;

      const entry = {
        id: id("kyc"),
        ...verification
      };

      db.kyc.push(entry);
      return { user, entry };
    });

    res.json({
      message: "KYC DEMO concluído.",
      warning: "Provedor de identidade é simulado.",
      ...result
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* =========================
   OTP / SMS DEMO
========================= */

app.post("/api/otp/send", authRequired, async (req, res) => {
  try {
    const db = await readDb();
    const user = db.users.find(u => u.id === req.auth.sub);

    if (!user?.phone) {
      return res.status(400).json({ error: "Utilizador sem telefone." });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));

    await updateDb(async db2 => {
      db2.otp = db2.otp.filter(o => o.userId !== user.id);
      db2.otp.push({
        id: id("otp"),
        userId: user.id,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        used: false
      });
    });

    await smsProvider.send({
      phone: user.phone,
      message: `Seu código VoxBet DEMO é ${code}`
    });

    res.json({
      message: "OTP enviado.",
      // Só para desenvolvimento:
      devCode: code
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   APOSTAS VIRTUAIS
========================= */

app.post("/api/bets", authRequired, async (req, res) => {
  try {
    const { selections, stake } = req.body;

    if (!Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ error: "Selections são obrigatórias." });
    }

    const numericStake = toNumber(stake);

    if (numericStake <= 0) {
      return res.status(400).json({ error: "Stake inválida." });
    }

    const totalOdd = selections.reduce(
      (acc, item) => acc * Number(item.odd),
      1
    );

    const potentialWin = Number((numericStake * totalOdd).toFixed(2));

    const result = await updateDb(async db => {
      const wallet = db.wallets.find(w => w.userId === req.auth.sub);

      if (!wallet) {
        throw Object.assign(new Error("Carteira não encontrada."), { status: 404 });
      }

      if (wallet.balance < numericStake) {
        throw Object.assign(new Error("Créditos insuficientes."), { status: 400 });
      }

      wallet.balance -= numericStake;
      wallet.updatedAt = now();

      const bet = {
        id: id("bet"),
        userId: req.auth.sub,
        type: selections.length > 1 ? "MULTIPLE" : "SINGLE",
        selections,
        stake: numericStake,
        totalOdd: Number(totalOdd.toFixed(4)),
        potentialWin,
        status: "OPEN",
        currency: "VCOIN",
        createdAt: now()
      };

      db.bets.push(bet);

      db.transactions.push({
        id: id("txn"),
        userId: req.auth.sub,
        type: "VIRTUAL_BET",
        amount: -numericStake,
        status: "COMPLETED",
        reference: bet.id,
        currency: "VCOIN",
        createdAt: now()
      });

      return { bet, wallet };
    });

    res.status(201).json({
      message: "Aposta virtual criada.",
      warning: "Esta aplicação DEMO utiliza VCoins e não processa apostas monetárias reais.",
      ...result
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get("/api/bets", authRequired, async (req, res) => {
  const db = await readDb();

  const bets = db.bets
    .filter(b => b.userId === req.auth.sub)
    .sort((a, b) => new Date(b.createdAt) < new Date(a.createdAt) ? 1 : -1);

  res.json(bets);
});

/* =========================
   TRANSACTIONS
========================= */

app.get("/api/transactions", authRequired, async (req, res) => {
  const db = await readDb();

  const transactions = db.transactions
    .filter(t => t.userId === req.auth.sub)
    .sort((a, b) => new Date(b.createdAt) < new Date(a.createdAt) ? 1 : -1);

  res.json(transactions);
});

/* =========================
   NOTIFICAÇÕES
========================= */

app.get("/api/notifications", authRequired, async (req, res) => {
  const db = await readDb();

  res.json(
    db.notifications
      .filter(n => n.userId === req.auth.sub)
      .sort((a, b) => new Date(b.createdAt) < new Date(a.createdAt) ? 1 : -1)
  );
});

app.post("/api/notifications/test", authRequired, async (req, res) => {
  const notification = {
    id: id("notif"),
    userId: req.auth.sub,
    title: req.body.title || "VoxBet",
    message: req.body.message || "Notificação de demonstração.",
    read: false,
    createdAt: now()
  };

  await updateDb(async db => {
    db.notifications.push(notification);
  });

  res.status(201).json(notification);
});

/* =========================
   EMAIL DEMO
========================= */

app.post("/api/email/test", authRequired, async (req, res) => {
  const db = await readDb();
  const user = db.users.find(u => u.id === req.auth.sub);

  const result = await emailProvider({
    to: user.email,
    subject: req.body.subject || "VoxBet DEMO",
    text: req.body.text || "Email de demonstração."
  });

  res.json(result);
});

/* =========================
   ADMIN
========================= */

app.get("/api/admin/users", authRequired, adminRequired, async (req, res) => {
  const db = await readDb();

  res.json(
    db.users.map(({ passwordHash, ...safeUser }) => ({
      ...safeUser,
      wallet: db.wallets.find(w => w.userId === safeUser.id)
    }))
  );
});

app.get("/api/admin/stats", authRequired, adminRequired, async (req, res) => {
  const db = await readDb();

  const virtualStake = db.bets.reduce((sum, b) => sum + Number(b.stake || 0), 0);

  res.json({
    users: db.users.length,
    bets: db.bets.length,
    transactions: db.transactions.length,
    virtualStake,
    virtualBalances: db.wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0)
  });
});

/* =========================
   FALLBACK
========================= */

app.use((req, res) => {
  res.status(404).json({
    error: "Rota não encontrada.",
    path: req.originalUrl
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Erro interno.",
    details: err.details || undefined
  });
});

async function start() {
  await ensureDb();

  // const server = app.listen(PORT, () => {
  //   console.log(`VoxBet API: http://localhost:${PORT}`);
  //   console.log(`Docs básicos: http://localhost:${PORT}`);
  //   console.log(`API-Football: ${process.env.API_FOOTBALL_KEY ? "CONFIGURADA" : "NÃO CONFIGURADA"}`);
  // });

  // const PORT = process.env.PORT || 5000;

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`VoxBet API rodando na porta ${PORT}`);
    });

  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "*"
    }
  });

  io.on("connection", socket => {
    socket.emit("welcome", {
      message: "Ligação VoxBet estabelecida."
    });

    socket.on("join-event", eventId => {
      socket.join(`event:${eventId}`);
    });
  });

  // Consulta de jogos ao vivo para DEMO. Não fica agressiva:
  // no plano gratuito da API-Football há 100 req/dia e 10 req/min.
  // setInterval(async () => {
  //   if (!process.env.API_FOOTBALL_KEY) return;

  //   try {
  //     const live = await sports.getLiveFixtures();

  //     await updateDb(async db => {
  //       db.sync.lastLiveSync = now();
  //     });

  //     io.emit("sports:live", live);
  //   } catch (err) {
  //     console.error("Live sync:", err.message);
  //   }
  // }, 15 * 60 * 1000);

  // Testa a conexão e cacheia uma pequena lista de ligas a cada 6h.
  const syncLeagues = async () => {
    if (!process.env.API_FOOTBALL_KEY) return;

    try {
      const data = await sports.getLeagues({ current: "true" });
      await updateDb(async db => {
        db.sync.lastFixturesSync = now();
        db.sync.currentLeagues = data.response?.slice(0, 50) || [];
      });
      console.log("Ligas sincronizadas.");
    } catch (err) {
      console.error("League sync:", err.message);
    }
  };

  // syncLeagues();
  // setInterval(syncLeagues, 6 * 60 * 60 * 1000);
}

start().catch(err => {
  console.error("Falha ao iniciar:", err);
  process.exit(1);
});