# Proactive Care — Virtual Receptionist

A local, demo-ready hospital receptionist agent with a live appointment dashboard, patient chat simulator, slot-aware booking, facility FAQs, schedule delay announcements, opt-out handling, and an escalation queue. It uses Node.js built-ins, so no package installation or external service account is needed for the demo.

## Start locally

Requires Node.js 20 or later.

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). For auto-restart while editing, use `npm run dev`. To run the automated flows, use `npm test`.

The dashboard uses a simulated hospital and dates around October 12, 2026. All demo state resets when the server restarts. It does not contain real patient data and is not intended for clinical or production use.

## Architecture

```text
Browser dashboard / chat simulator
              │ JSON API
              ▼
        Node.js HTTP server
     ┌────────┼─────────────┐
     ▼        ▼             ▼
 Booking   Rule-based     Escalation
 + slots   conversations   + audit
     └────────┼─────────────┘
              ▼
  In-memory demo hospital data
              ▲
     Twilio SMS webhook (optional)
```

- `server.js` contains the HTTP API, conversation routing, booking rules, FAQs, handoff queue, delay notifications, and a Twilio-compatible inbound SMS endpoint.
- `client.js`, `index.html`, and `styles.css` provide the responsive staff dashboard and chat simulator.
- `data.js` holds simulated doctors, departments, appointments, initial activity, and hospital-managed FAQ content.
- `test/receptionist.test.js` exercises the core scheduling, safety, escalation, FAQ, opt-out, and webhook flows.

## Conversation flows

1. **Book:** The patient names a specialty. The agent selects the matching doctor, checks a free demo slot, creates a confirmed appointment, and returns the appointment ID. Staff can also book from **New appointment**.
2. **Cancel/reschedule:** The demo can modify an existing appointment matched to the current demo phone. If it cannot establish that match, it asks for an appointment ID instead of revealing details. The schedule frees cancelled slots. The chat simulator intentionally uses a shared demo identity, so use separate phone identifiers when exercising these flows through the API.
3. **Delay update:** Staff select a doctor, date, and delay. One notice is recorded per affected non-cancelled appointment, and identical repeats are deduplicated.
4. **Facility FAQ:** Replies are grounded in the fixed entries in `data.js`. Unknown questions receive an uncertainty response and are placed in the human handoff queue.
5. **Clinical and emergency safety:** Clinical questions are redirected to a clinician. Emergency keywords return the demo emergency line and 112, and add a staff handoff. Replace the example emergency number and verify response wording with the hospital before use.
6. **Opt-out:** `STOP` suppresses further replies for that phone; `START` restores them.
7. **Human handoff:** Explicit requests, emergencies, and unsupported questions create a queue item containing a concise transcript summary. Staff can mark a handoff resolved from the dashboard.

Every response identifies the service as an automated assistant. This demo uses simple keyword rules for predictable behavior; it is not an LLM and does not claim to interpret all languages, typos, or free-form intent reliably.

## Phone and messaging setup

The app runs locally and the simulator works without any credentials. A real phone number cannot call the local laptop merely by starting the app. For inbound SMS, deploy the server to a public HTTPS URL and configure a Twilio number's incoming-message webhook as:

```text
POST https://YOUR_PUBLIC_HOST/api/twilio/sms
```

Copy `.env.example` to `.env`, add the Twilio account values, then restart the app. `GET /api/health` reports whether these variables are present. The webhook currently accepts standard form-encoded Twilio fields (`From` and `Body`) or JSON and returns TwiML. Before exposing it publicly, add Twilio signature validation, HTTPS termination, secure secrets, durable storage, provider delivery-status callbacks, retries, rate limiting, and consent/identity enforcement. This scaffold does not originate outbound phone calls or connect a live provider account.

## Configuration and next production steps

- Edit simulated doctors, departments, FAQ knowledge, and sample appointments in `data.js`.
- The dashboard's reminder cards are demonstration metrics; a real reminder scheduler and delivery adapter are not wired yet.
- The demo data, conversations, audit, opt-out state, and handoffs live in memory. Use an encrypted, access-controlled persistent database and retention policy before production.
- A production assistant needs verified patient identity before retrieving appointment details, explicit channel consent, authenticated staff accounts/roles, immutable audit storage, localization, clinical review of emergency messaging, validated knowledge-base editing, and healthcare privacy/security review for the applicable jurisdiction.
- Schedule updates in the demo use the appointment time as the displayed estimate and offer WAIT/RESCHEDULE/CANCEL choices. A production scheduler should compute realistic estimates and process those responses through verified appointment context.
- Error states stay conservative: unavailable slots are rejected, unsupported facility questions are escalated, and patient-identifiable details are not put into demo audit records.

## Example conversations

| Scenario | Patient message | Demo behavior |
| --- | --- | --- |
| Book | “Can I book cardiology?” | Finds Dr. Aisha Mehta and creates a free slot. |
| FAQ | “Where can I park?” | Gives the hospital-managed basement parking answer. |
| Unknown FAQ | “Is there a rooftop cafe?” | Does not guess; adds a handoff. |
| Delay | Staff reports a 25-minute doctor delay | Notifies active same-day appointments once. |
| Identity | “Cancel my appointment” from an unknown phone | Asks for an appointment ID. |
| Clinical | “What medicine should I take for fever?” | Declines medical guidance and directs the patient to a clinician. |
| Emergency | “I have severe chest pain” | Directs to emergency help and flags staff. |
| Handoff | “I want to speak to a receptionist” | Queues the request with conversation context. |
| Opt out | “STOP” then another question | Confirms opt-out and suppresses a reply until “START”. |

## API overview

- `GET /api/dashboard` — demo schedule, message feed, metrics, handoffs, audit, departments, doctors.
- `POST /api/chat` — `{ "patient", "phone", "channel", "message" }`.
- `POST /api/appointments` — create a booking after checking slot availability.
- `POST /api/appointments/status` — staff/demo appointment status update.
- `POST /api/delays` — create deduplicated delay notices.
- `POST /api/escalations/status` — update handoff status.
- `POST /api/twilio/sms` — inbound Twilio-compatible SMS/WhatsApp webhook.
- `GET /api/health` — server and telephony configuration status.
