import http from "node:http";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { doctors, departments, initialAppointments, initialMessages, knowledge } from "./data.js";

const port = Number(process.env.PORT || 3000);
const appointments = structuredClone(initialAppointments);
const messages = structuredClone(initialMessages);
const conversations = new Map();
const escalationQueue = [];
const optOut = new Set();
const audit = [{ id: "AUD-1001", action: "System started", detail: "Receptionist assistant is ready", time: "09:00" }];
const slots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00"];
const simulatedToday = "2026-10-12";
function addDays(date, count) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + count);
  return next.toISOString().slice(0, 10);
}
function formatTime(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour % 12 || 12).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function log(action, detail) {
  audit.unshift({ id: `AUD-${Date.now()}`, action, detail, time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) });
}
function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" });
  res.end(JSON.stringify(data));
}
async function body(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  if (req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(raw));
  return JSON.parse(raw);
}
function doctorFor(id) { return doctors.find((doctor) => doctor.id === id); }
function slotAvailable(doctorId, date, time) {
  return !appointments.some((appointment) => appointment.doctorId === doctorId && appointment.date === date && appointment.time === time && appointment.status !== "Cancelled");
}
function safeReply(text) { return `🤖 ${text}`; }
function enqueueEscalation(patient, phone, reason, transcript) {
  if (!escalationQueue.some((item) => item.phone === phone && item.status === "Waiting")) {
    escalationQueue.unshift({ id: `ESC-${Date.now()}`, patient, phone, reason, summary: transcript.slice(-5).map((item) => `${item.role}: ${item.text}`).join(" | "), status: "Waiting", time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) });
  }
  log("Human handoff", `${patient} · ${reason}`);
}
function addMessage(patient, channel, direction, text, status) {
  messages.unshift({ id: `MSG-${Date.now()}`, patient, channel, direction, body: text, time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), status });
}

function handleChat(input) {
  const patient = String(input.patient || "Guest").trim().slice(0, 80) || "Guest";
  const phone = String(input.phone || "demo").trim().slice(0, 40);
  const channel = ["WhatsApp", "Phone", "Web chat"].includes(input.channel) ? input.channel : "Web chat";
  const text = String(input.message || "").trim().slice(0, 1000);
  if (!text) return { reply: safeReply("Please tell me how I can help."), intent: "clarify" };
  if (/^(stop|unsubscribe|opt out|cancel messages)$/i.test(text)) {
    optOut.add(phone); log("Opt-out", `Patient ${phone.slice(-4)} requested no more messages`);
    return { reply: safeReply("You’re opted out of messages. We won’t send more. Reply START if you’d like to opt back in."), intent: "opt-out" };
  }
  if (/\b(start|opt in)\b/i.test(text) && optOut.has(phone)) {
    optOut.delete(phone); log("Opt-in", `Patient ${phone.slice(-4)} opted in again`);
    return { reply: safeReply("You’re opted back in. How can I help today?"), intent: "opt-in" };
  }
  if (optOut.has(phone)) return { reply: "", intent: "opt-out" };

  const history = conversations.get(phone) || [];
  history.push({ role: "patient", text });
  conversations.set(phone, history);
  let intent = "faq";
  let reply;
  const emergency = /\b(chest pain|can't breathe|cannot breathe|difficulty breathing|severe bleeding|suicid|unconscious|stroke|heart attack|emergency)\b/i.test(text);
  const clinical = /\b(symptom|diagnos|medicine|medication|dose|dosage|pain|rash|fever|treatment|prescription)\b/i.test(text);
  const human = /\b(human|person|receptionist|staff|complaint|angry|frustrat|manager)\b/i.test(text);
  if (emergency) {
    intent = "emergency";
    reply = safeReply("If this may be an emergency, call 112 now or go to your nearest emergency department. Proactive Care emergency line: +91 80 4000 1122. I’m flagging this conversation for our staff. I can’t assess symptoms here.");
    enqueueEscalation(patient, phone, "Urgent language detected", history);
  } else if (clinical) {
    intent = "clinical-safety";
    reply = safeReply("I can’t provide medical advice. Please contact a clinician or book an appointment. If you think this is an emergency, call 112 now.");
  } else if (human) {
    intent = "handoff";
    reply = safeReply("I’ve asked our reception team to join this conversation. They’ll see the messages you’ve already sent.");
    enqueueEscalation(patient, phone, "Patient requested staff or sensitive concern", history);
  } else {
    const lower = text.toLowerCase();
    const booking = /\b(book|appointment|schedule|reschedule|cancel)\b/i.test(text);
    const specialty = doctors.find((doctor) => lower.includes(doctor.specialty.toLowerCase()));
    if (booking && /\bcancel\b/i.test(text)) {
      const appointment = appointments.find((item) => item.phone === phone && item.status !== "Cancelled");
      if (appointment) {
        appointment.status = "Cancelled";
        intent = "cancel";
        reply = safeReply(`Your appointment ${appointment.id} with ${doctorFor(appointment.doctorId).name} on ${appointment.date} has been cancelled. The slot is available again. Would you like another time?`);
        log("Appointment cancelled", `${appointment.id} · ${patient}`);
      } else {
        intent = "identity-required";
        reply = safeReply("I can help with that. To protect your privacy, please share your appointment ID or contact our reception team to verify your identity.");
      }
    } else if (booking && /\b(reschedule|move|change time|change date)\b/i.test(text)) {
      const appointment = appointments.find((item) => item.phone === phone && item.status !== "Cancelled");
      if (appointment) {
        const next = slots.find((time) => time > appointment.time && slotAvailable(appointment.doctorId, appointment.date, time));
        if (next) { const old = appointment.time; appointment.time = next; intent = "reschedule"; reply = safeReply(`Your appointment is moved from ${old} to ${next} on ${appointment.date} with ${doctorFor(appointment.doctorId).name}.`); log("Appointment rescheduled", `${appointment.id} · ${old} → ${next}`); }
        else { intent = "handoff"; reply = safeReply("I couldn’t find another suitable slot, so I’ve asked reception to help you reschedule."); enqueueEscalation(patient, phone, "No matching reschedule slot", history); }
      } else { intent = "identity-required"; reply = safeReply("Please share your appointment ID so I can safely find the booking you want to change."); }
    } else if (booking && specialty) {
      const availableDate = addDays(simulatedToday, 1);
      const time = slots.find((slot) => slotAvailable(specialty.id, availableDate, slot));
      if (!time) { intent = "unavailable"; reply = safeReply(`I couldn’t find an available slot with ${specialty.name}. Would you like another date or a different doctor?`); }
      else {
        const appointment = { id: `APT-${Date.now().toString().slice(-6)}`, patient, phone, doctorId: specialty.id, date: availableDate, time, status: "Confirmed", reason: `${specialty.specialty} appointment`, source: channel };
        appointments.unshift(appointment); intent = "booked";
        reply = safeReply(`You’re booked with ${specialty.name} (${specialty.specialty}) on ${availableDate} at ${time}. Your appointment ID is ${appointment.id}. Reply RESCHEDULE or CANCEL if plans change.`);
        log("Appointment booked", `${appointment.id} · ${specialty.name} · ${patient}`);
      }
    } else {
      const answer = knowledge.find((item) => item.keywords.some((keyword) => lower.includes(keyword)));
      if (answer) reply = safeReply(`${answer.answer} How else can I help?`);
      else {
        intent = "uncertain";
        reply = safeReply("I’m not certain about that, and I don’t want to give you incorrect information. I’ve asked reception to follow up with you.");
        enqueueEscalation(patient, phone, "Question not answered by hospital knowledge base", history);
      }
    }
  }
  if (reply) { history.push({ role: "assistant", text: reply }); addMessage(patient, channel, "Inbound", text, "Received"); addMessage(patient, channel, "Outbound", reply, "Delivered"); }
  return { reply, intent, escalated: ["emergency", "handoff", "uncertain"].includes(intent) };
}

const app = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/dashboard") {
      return json(res, 200, { doctors, departments, appointments, messages, escalations: escalationQueue, audit, simulatedToday, metrics: { todayAppointments: appointments.filter((item) => item.date === simulatedToday && item.status !== "Cancelled").length, remindersSent: messages.filter((message) => /reminder/i.test(message.body)).length, activeConversations: conversations.size, pendingHandoffs: escalationQueue.filter((item) => item.status === "Waiting").length, completionRate: "94%", avgResponse: "< 1 min" } });
    }
    if (req.method === "POST" && url.pathname === "/api/chat") {
      const result = handleChat(await body(req));
      return json(res, 200, result);
    }
    if (req.method === "POST" && url.pathname === "/api/appointments") {
      const input = await body(req);
      const patient = String(input.patient || "").trim();
      const phone = String(input.phone || "").trim();
      const doctor = doctorFor(input.doctorId);
      const date = String(input.date || "");
      const time = String(input.time || "");
      if (!patient || !phone || !doctor || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !slots.includes(time)) return json(res, 400, { error: "Please enter a patient name, phone, valid date and time, and doctor." });
      if (!slotAvailable(doctor.id, date, time)) return json(res, 409, { error: "That slot is already booked. Please choose another time." });
      const appointment = { id: `APT-${Date.now().toString().slice(-6)}`, patient, phone, doctorId: doctor.id, date, time, status: "Confirmed", reason: String(input.reason || `${doctor.specialty} appointment`), source: "Dashboard" };
      appointments.unshift(appointment); log("Appointment booked", `${appointment.id} · ${doctor.name} · ${patient}`);
      return json(res, 201, { appointment });
    }
    if (req.method === "POST" && url.pathname === "/api/appointments/status") {
      const input = await body(req);
      const appointment = appointments.find((item) => item.id === input.id);
      if (!appointment || !["Confirmed", "Cancelled", "Pending"].includes(input.status)) return json(res, 400, { error: "Appointment or status was not recognized." });
      appointment.status = input.status; log(`Appointment ${input.status.toLowerCase()}`, appointment.id);
      return json(res, 200, { appointment });
    }
    if (req.method === "POST" && url.pathname === "/api/delays") {
      const input = await body(req);
      const doctor = doctorFor(input.doctorId);
      const delay = Number(input.delayMinutes);
      if (!doctor || !Number.isFinite(delay) || delay < 1 || delay > 480) return json(res, 400, { error: "Choose a doctor and a delay between 1 and 480 minutes." });
      const affected = appointments.filter((item) => item.doctorId === doctor.id && item.date === String(input.date || "") && item.status !== "Cancelled");
      let notified = 0;
      for (const appointment of affected) {
        const key = `delay:${appointment.id}:${input.delayMinutes}`;
        if (messages.some((message) => message.dedupeKey === key)) continue;
        const [hour, minute] = appointment.time.split(":").map(Number);
        const eta = formatTime(hour * 60 + minute + delay);
        const note = `We’re sorry, ${doctor.name} is running about ${delay} minutes late. Your updated estimated appointment time is ${eta}. Reply WAIT, RESCHEDULE, or CANCEL.`;
        messages.unshift({ id: `MSG-${Date.now()}-${notified}`, patient: appointment.patient, channel: appointment.source, direction: "Outbound", body: note, time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), status: "Delivered", dedupeKey: key });
        notified++; log("Delay notification sent", `${appointment.id} · ${delay} min`);
      }
      return json(res, 200, { notified });
    }
    if (req.method === "POST" && url.pathname === "/api/escalations/status") {
      const input = await body(req);
      const item = escalationQueue.find((entry) => entry.id === input.id);
      if (!item || !["Waiting", "In progress", "Resolved"].includes(input.status)) return json(res, 400, { error: "Handoff or status was not recognized." });
      item.status = input.status; log("Handoff updated", `${item.id} · ${item.status}`);
      return json(res, 200, { escalation: item });
    }
    if (req.method === "POST" && url.pathname === "/api/twilio/sms") {
      const input = await body(req);
      const result = handleChat({ patient: input.patient || "Patient", phone: input.From || "unknown", message: input.Body, channel: "WhatsApp" });
      const escapeXml = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      res.writeHead(200, { "Content-Type": "text/xml; charset=utf-8" });
      res.end(`<?xml version="1.0" encoding="UTF-8"?><Response>${result.reply ? `<Message>${escapeXml(result.reply)}</Message>` : ""}</Response>`);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/health") return json(res, 200, { status: "ok", mode: "demo", liveTelephony: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) });
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const fs = await import("node:fs/promises"); res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(await fs.readFile(new URL("./index.html", import.meta.url))); return;
    }
    if (req.method === "GET" && url.pathname === "/styles.css") {
      const fs = await import("node:fs/promises"); res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" }); res.end(await fs.readFile(new URL("./styles.css", import.meta.url))); return;
    }
    if (req.method === "GET" && url.pathname === "/app.js") {
      const fs = await import("node:fs/promises"); res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" }); res.end(await fs.readFile(new URL("./client.js", import.meta.url))); return;
    }
    json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "The receptionist could not process that request." });
  }
});

app.listen(port, () => console.log(`Proactive Care demo running at http://localhost:${port}`));
