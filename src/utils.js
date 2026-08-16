const crypto = require("crypto");

function id(prefix = "id") {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function toNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("Valor numérico inválido.");
  return n;
}

module.exports = { id, now, toNumber };