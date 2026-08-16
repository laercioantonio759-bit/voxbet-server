# VoxBet Node Demo

Backend demonstrativo em Node.js puro para o VoxBet.

## O que tem

- API REST com Express
- API-Football para:
  - países
  - ligas
  - fixtures
  - jogos ao vivo
  - odds
  - odds live
  - predictions
  - standings
  - estatísticas
  - eventos
- JWT
- bcrypt
- carteira virtual com VCoins
- apostas virtuais simples e múltiplas
- depósitos/levantamentos DEMO
- KYC DEMO
- OTP/SMS DEMO
- email DEMO
- notificações
- Socket.IO
- persistência em `data/db.json`

## Instalação

```bash
npm install
```

Copiar `.env.example` para `.env` e colocar a chave da API-Football:

```env
API_FOOTBALL_KEY=sua_chave
```

## Inicialização

```bash
npm run seed
npm run dev
```

Servidor:

http://localhost:5000

## Rotas principais

GET  /api/health

POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me

GET /api/sports/countries
GET /api/sports/leagues
GET /api/sports/fixtures
GET /api/sports/fixtures/:id
GET /api/sports/live
GET /api/sports/odds
GET /api/sports/odds/live
GET /api/sports/predictions/:fixture
GET /api/sports/standings
GET /api/sports/statistics/:fixture
GET /api/sports/events/:fixture

GET /api/wallet
POST /api/payments/deposit
POST /api/payments/withdraw

POST /api/kyc/verify
POST /api/otp/send

POST /api/bets
GET /api/bets
GET /api/transactions

GET /api/notifications
POST /api/notifications/test
POST /api/email/test

GET /api/admin/users
GET /api/admin/stats

## Login de administrador após npm run seed

Email:
admin@voxbet.local

Senha:
Admin@123

## Observação

Este projeto é apenas DEMONSTRATIVO. `VCoins` são créditos fictícios. O provider de pagamentos, KYC e SMS é simulado. Não há processamento de dinheiro real.# voxbet-server
