const axios = require("axios");

const BASE_URL = process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";
const KEY = process.env.API_FOOTBALL_KEY;

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: KEY ? { "x-apisports-key": KEY } : {}
});

function requireKey() {
  if (!KEY) {
    const err = new Error("API_FOOTBALL_KEY não configurada.");
    err.status = 503;
    throw err;
  }
}

function extract1X2Odds(oddsData) {
  const result = {
    home: null,
    draw: null,
    away: null
  };

  if (!oddsData) {
    return result;
  }

  const bookmakers = oddsData.bookmakers || [];

  if (!bookmakers.length) {
    return result;
  }

  const bookmaker = bookmakers[0];

  const markets = bookmaker.bets || [];

  const matchWinner = markets.find(
    market =>
      market.name === "Match Winner" ||
      market.name === "1X2"
  );

  if (!matchWinner) {
    return result;
  }

  for (const value of matchWinner.values || []) {

    if (value.value === "Home") {
      result.home = Number(value.odd);
    }

    if (value.value === "Draw") {
      result.draw = Number(value.odd);
    }

    if (value.value === "Away") {
      result.away = Number(value.odd);
    }
  }

  return result;
}

async function apiFootball(path, params = {}) {
  requireKey();
  const response = await client.get(path, { params });
  const data = response.data;

  if (data.errors && Object.keys(data.errors).length > 0) {
    const err = new Error("API-Football retornou erro.");
    err.details = data.errors;
    err.status = 502;
    throw err;
  }

  return data;
}

function formatMatchTime(date, status) {
  if (!date) return "";

  if (isLiveStatus(status)) {
    const elapsed = status?.elapsed;

    return elapsed
      ? `${elapsed}:00`
      : "Ao Vivo";
  }

  const matchDate = new Date(date);

  const now = new Date();

  const sameDay =
    matchDate.toDateString() === now.toDateString();

  const time = matchDate.toLocaleTimeString("pt-AO", {
    hour: "2-digit",
    minute: "2-digit"
  });

  if (sameDay) {
    return `Hoje - ${time}`;
  }

  return matchDate.toLocaleDateString("pt-AO", {
    day: "2-digit",
    month: "2-digit"
  }) + ` - ${time}`;
}

function isLiveStatus(status) {
  if (!status) return false;

  const liveStatuses = [
    "1H",
    "2H",
    "HT",
    "ET",
    "P",
    "LIVE"
  ];

  return liveStatuses.includes(status.short);
}

function normalizeFixture(item, oddsData = null) {
  const status = item.fixture?.status;

  const home = item.teams?.home;
  const away = item.teams?.away;

  const homeScore = item.goals?.home ?? 0;
  const awayScore = item.goals?.away ?? 0;

  return {
    id: String(item.fixture?.id),

    league: item.league?.name || "Desporto",

    leagueId: item.league?.id || null,

    homeTeam: home?.name || "Casa",
    awayTeam: away?.name || "Fora",

    homeLogo: home?.logo || null,
    awayLogo: away?.logo || null,

    time: formatMatchTime(
      item.fixture?.date,
      status
    ),

    date: item.fixture?.date || null,

    isLive: isLiveStatus(status),

    status: status?.short || "NS",

    score: {
      home: homeScore,
      away: awayScore
    },

    odds: extract1X2Odds(oddsData)
  };
}

async function getCountries() {
  return apiFootball("/countries");
}

async function getLeagues(params = {}) {
  return apiFootball("/leagues", params);
}

async function getFixtures(params = {}) {
  const data = await apiFootball("/fixtures", params);

  const fixtures = data.response || [];

  const normalized = [];

  for (const fixture of fixtures.slice(0, 5)) {

    let oddsData = null;

    try {
      const oddsResponse = await apiFootball("/odds", {
        fixture: fixture.fixture.id
      });

      oddsData = oddsResponse.response?.[0] || null;

    } catch (error) {
      console.error(
        `Erro ao buscar odds do jogo ${fixture.fixture?.id}:`,
        error.message
      );
    }

    normalized.push(
      normalizeFixture(fixture, oddsData)
    );
  }

  return {
    ...data,
    response: normalized
  };
}

async function getFixture(id) {
  return getFixtures({ id });
}

async function getLiveFixtures() {
  return getFixtures({ live: "all" });
}

async function getOdds(params = {}) {
  return apiFootball("/odds", params);
}

async function getLiveOdds(params = {}) {
  return apiFootball("/odds/live", params);
}

async function getPrediction(fixture) {
  return apiFootball("/predictions", { fixture });
}

async function getStandings(params = {}) {
  return apiFootball("/standings", params);
}

async function getStatistics(params = {}) {
  return apiFootball("/fixtures/statistics", params);
}

async function getEvents(fixture) {
  return apiFootball("/fixtures/events", { fixture });
}

module.exports = {
  getCountries,
  getLeagues,
  getFixtures,
  getFixture,
  getLiveFixtures,
  getOdds,
  getLiveOdds,
  getPrediction,
  getStandings,
  getStatistics,
  getEvents
};