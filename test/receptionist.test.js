import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

let server;
let baseUrl;
let testDatabase;

test.before(async () => {
  const port = 3100 + Math.floor(Math.random() * 500);
  testDatabase = join(tmpdir(), `proactive-care-test-${randomUUID()}.sqlite`);
  server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT: String(port), DATABASE_PATH: testDatabase }, stdio: "ignore" });
  baseUrl = `http://127.0.0.1:${port}`;
  for (let attempts = 0; attempts < 50; attempts++) {
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Demo server did not start.");
});
test.after(() => { server?.kill(); });

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

test("dashboard returns demo schedule, care team, audit data, and SQLite health", async () => {
  const response = await fetch(`${baseUrl}/api/dashboard`);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.ok(data.doctors.length >= 5);
  assert.ok(data.appointments.length >= 8);
  assert.ok(data.audit.length >= 1);
  const health = await (await fetch(`${baseUrl}/api/health`)).json();
  assert.equal(health.database, "sqlite");
  assert.equal(health.liveTelephony, false);
  assert.equal(health.callNumber, null);
});

test("books only a free doctor slot and rejects conflicts", async () => {
  const booking = { patient: "Test Patient", phone: "+91 90000 00001", doctorId: "D-101", date: "2026-10-20", time: "09:00", reason: "Check-up" };
  const first = await post("/api/appointments", booking);
  assert.equal(first.status, 201);
  assert.equal(first.body.appointment.status, "Confirmed");
  const duplicate = await post("/api/appointments", { ...booking, patient: "Another Patient", phone: "+91 90000 00002" });
  assert.equal(duplicate.status, 409);
  const db = new DatabaseSync(testDatabase);
  assert.equal(db.prepare("SELECT patient FROM appointments WHERE id = ?").get(first.body.appointment.id).patient, "Test Patient");
  db.close();
  const availability = await fetch(`${baseUrl}/api/availability?doctorId=D-101&date=2026-10-20`);
  const openSlots = await availability.json();
  assert.equal(openSlots.slots.includes("09:00"), false);
});

test("assistant books a named specialty with a matching doctor", async () => {
  const result = await post("/api/chat", { patient: "Demo Patient", phone: "booking-test", message: "Please book cardiology", channel: "Web chat" });
  assert.equal(result.status, 200);
  assert.equal(result.body.intent, "booked");
  assert.match(result.body.reply, /Dr\. Aisha Mehta/);
});

test("unverified appointment changes require identity information", async () => {
  const result = await post("/api/chat", { patient: "Unknown", phone: "unknown-test", message: "cancel my appointment", channel: "Web chat" });
  assert.equal(result.body.intent, "identity-required");
  assert.match(result.body.reply, /appointment ID/i);
});

test("FAQ answers stay within facility information and unknown questions escalate", async () => {
  const faq = await post("/api/chat", { patient: "Guest", phone: "faq-test", message: "Where is parking?", channel: "Web chat" });
  assert.match(faq.body.reply, /basement/);
  const unknown = await post("/api/chat", { patient: "Guest", phone: "unknown-faq-test", message: "Do you have a rooftop cafe?", channel: "Web chat" });
  assert.equal(unknown.body.intent, "uncertain");
  assert.equal(unknown.body.escalated, true);
});

test("clinical and emergency messages use safe replies and emergency is escalated", async () => {
  const medical = await post("/api/chat", { patient: "Guest", phone: "medical-test", message: "What medicine should I take for a fever?", channel: "Web chat" });
  assert.equal(medical.body.intent, "clinical-safety");
  assert.match(medical.body.reply, /can’t provide medical advice/i);
  const emergency = await post("/api/chat", { patient: "Guest", phone: "emergency-test", message: "I have severe chest pain", channel: "Web chat" });
  assert.equal(emergency.body.intent, "emergency");
  assert.equal(emergency.body.escalated, true);
  assert.match(emergency.body.reply, /112/);
  const dashboard = await (await fetch(`${baseUrl}/api/dashboard`)).json();
  assert.ok(dashboard.escalations.some((item) => item.reason.includes("Urgent")));
});

test("human requests create a handoff with a conversation summary", async () => {
  await post("/api/chat", { patient: "Guest", phone: "handoff-test", message: "Hi there", channel: "Web chat" });
  const result = await post("/api/chat", { patient: "Guest", phone: "handoff-test", message: "I want to speak with a receptionist", channel: "Web chat" });
  assert.equal(result.body.intent, "handoff");
  const dashboard = await (await fetch(`${baseUrl}/api/dashboard`)).json();
  assert.ok(dashboard.escalations.find((item) => item.phone === "handoff-test").summary.includes("Hi there"));
});

test("STOP opts out and suppresses subsequent responses until START", async () => {
  const stop = await post("/api/chat", { patient: "Guest", phone: "opt-test", message: "STOP", channel: "WhatsApp" });
  assert.equal(stop.body.intent, "opt-out");
  const suppressed = await post("/api/chat", { patient: "Guest", phone: "opt-test", message: "Where is parking?", channel: "WhatsApp" });
  assert.equal(suppressed.body.reply, "");
  const start = await post("/api/chat", { patient: "Guest", phone: "opt-test", message: "START", channel: "WhatsApp" });
  assert.equal(start.body.intent, "opt-in");
});

test("doctor delay notifications target active appointments and are deduplicated", async () => {
  const request = { doctorId: "D-102", date: "2026-10-12", delayMinutes: 25 };
  const first = await post("/api/delays", request);
  assert.equal(first.body.notified, 1);
  const second = await post("/api/delays", request);
  assert.equal(second.body.notified, 0);
});

test("Twilio SMS webhook returns TwiML and health reports demo mode", async () => {
  const sms = await fetch(`${baseUrl}/api/twilio/sms`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ From: "+919900000000", Body: "Where is parking?" }) });
  assert.equal(sms.status, 200);
  assert.match(await sms.text(), /basement/);
  const webhook = await fetch(`${baseUrl}/api/twilio/sms`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "From=%2B919900000000&Body=Hello" });
  assert.match(await webhook.text(), /<Response>/);
  const health = await (await fetch(`${baseUrl}/api/health`)).json();
  assert.equal(health.status, "ok");
  assert.equal(health.mode, "demo");
  const greeting = await fetch(`${baseUrl}/api/twilio/voice`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "From=%2B919911111111&CallSid=CA-demo" });
  assert.match(await greeting.text(), /<Gather/);
  const urgentCall = await fetch(`${baseUrl}/api/twilio/voice`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "From=%2B919922222222&CallSid=CA-urgent&SpeechResult=I%20have%20chest%20pain" });
  const urgentResponse = await urgentCall.text();
  assert.match(urgentResponse, /call 112 now/i);
  assert.match(urgentResponse, /<Hangup\/>/);
  const urgentDashboard = await (await fetch(`${baseUrl}/api/dashboard`)).json();
  assert.ok(urgentDashboard.escalations.some((item) => item.reason.includes("Urgent language detected during phone call")));
  const identity = await fetch(`${baseUrl}/api/twilio/voice?step=identity`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "From=%2B919911111111&CallSid=CA-demo&SpeechResult=Voice%20Test" });
  assert.match(await identity.text(), /Which specialty/);
  const specialty = await fetch(`${baseUrl}/api/twilio/voice?step=specialty`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "From=%2B919911111111&CallSid=CA-demo&SpeechResult=cardiology" });
  const offer = await specialty.text();
  assert.match(offer, /<Gather/);
  assert.match(offer, /appointment tomorrow/i);
  const currentSchedule = await (await fetch(`${baseUrl}/api/dashboard`)).json();
  const available = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00"].find((time) => !currentSchedule.appointments.some((item) => item.doctorId === "D-101" && item.date === "2026-10-13" && item.time === time && item.status !== "Cancelled"));
  assert.ok(available, "voice test should have a free demo slot");
  const confirm = await fetch(`${baseUrl}/api/twilio/voice?step=confirm`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "Digits=1&From=%2B919911111111&CallSid=CA-demo" });
  assert.match(await confirm.text(), /Your appointment is booked/);
  const afterCall = await (await fetch(`${baseUrl}/api/dashboard`)).json();
  assert.ok(afterCall.appointments.some((item) => item.source === "Phone" && item.phone === "+919911111111"));
  assert.ok(afterCall.appointments.some((item) => item.source === "Phone" && item.patient === "Voice Test"));
  assert.ok(afterCall.messages.some((item) => item.channel === "Phone" && item.direction === "Outbound" && item.body.includes("appointment is booked")));
  const logo = await fetch(`${baseUrl}/assets/proactive-care-mark.png`);
  assert.equal(logo.status, 200);
  assert.equal(logo.headers.get("content-type"), "image/png");
});
