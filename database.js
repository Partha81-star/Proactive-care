import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initialAppointments, initialMessages } from "./data.js";

const defaultDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "data");
fs.mkdirSync(process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : defaultDirectory, { recursive: true });
export const databasePath = process.env.DATABASE_PATH || path.join(defaultDirectory, "proactive-care.sqlite");
export const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY, patient TEXT NOT NULL, phone TEXT NOT NULL,
    doctorId TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL,
    status TEXT NOT NULL, reason TEXT, source TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS active_doctor_slot
    ON appointments(doctorId, date, time) WHERE status != 'Cancelled';
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, patient TEXT NOT NULL, channel TEXT NOT NULL,
    direction TEXT NOT NULL, body TEXT NOT NULL, time TEXT NOT NULL,
    status TEXT NOT NULL, dedupeKey TEXT UNIQUE
  );
  CREATE TABLE IF NOT EXISTS escalations (
    id TEXT PRIMARY KEY, patient TEXT NOT NULL, phone TEXT NOT NULL,
    reason TEXT NOT NULL, summary TEXT NOT NULL, status TEXT NOT NULL, time TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit (
    id TEXT PRIMARY KEY, action TEXT NOT NULL, detail TEXT NOT NULL, time TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS conversations (
    phone TEXT PRIMARY KEY, transcript TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS preferences (
    phone TEXT PRIMARY KEY, optedOut INTEGER NOT NULL DEFAULT 0
  );
`);

function count(table) { return db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count; }
if (count("appointments") === 0) {
  const insert = db.prepare("INSERT INTO appointments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const item of initialAppointments) insert.run(item.id, item.patient, item.phone, item.doctorId, item.date, item.time, item.status, item.reason, item.source);
}
if (count("messages") === 0) {
  const insert = db.prepare("INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, NULL)");
  for (const item of initialMessages) insert.run(item.id, item.patient, item.channel, item.direction, item.body, item.time, item.status);
}
if (count("audit") === 0) {
  db.prepare("INSERT INTO audit VALUES (?, ?, ?, ?)").run("AUD-1001", "System started", "Receptionist assistant is ready", "09:00");
}

export function all(table, limit = 250) {
  return db.prepare(`SELECT * FROM ${table} ORDER BY rowid DESC LIMIT ?`).all(limit);
}
export function saveConversation(phone, transcript) {
  db.prepare(`INSERT INTO conversations(phone, transcript) VALUES(?, ?)
    ON CONFLICT(phone) DO UPDATE SET transcript=excluded.transcript`).run(phone, JSON.stringify(transcript));
}
export function loadConversation(phone) {
  const row = db.prepare("SELECT transcript FROM conversations WHERE phone = ?").get(phone);
  return row ? JSON.parse(row.transcript) : [];
}
export function isOptedOut(phone) {
  return Boolean(db.prepare("SELECT optedOut FROM preferences WHERE phone = ?").get(phone)?.optedOut);
}
export function setOptOut(phone, value) {
  db.prepare(`INSERT INTO preferences(phone, optedOut) VALUES(?, ?)
    ON CONFLICT(phone) DO UPDATE SET optedOut=excluded.optedOut`).run(phone, value ? 1 : 0);
}
