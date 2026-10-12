# Proactive Care — Virtual Receptionist

A local, demo-ready hospital receptionist agent with a live appointment dashboard, patient chat simulator, slot-aware booking, facility FAQs, schedule delay announcements, opt-out handling, a voice-call booking webhook, and an escalation queue. It uses Node.js built-ins, including SQLite, so no package installation is needed for the demo.

## Start locally

Requires Node.js 22.5 or later (for the built-in SQLite module).

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). For auto-restart while editing, use `npm run dev`. To run the automated flows, use `npm test`. The dashboard's **Start call simulator** lets you speak or type through a phone-style booking locally; bookings and call records appear in SQLite and the dashboard.

The dashboard uses a simulated hospital. Appointment, conversation, message, opt-out, handoff, and audit records persist in `data/proactive-care.sqlite`. Sample data is inserted the first time the database is initialized; subsequent restarts preserve changes. It does not contain real patient data and is not intended for clinical or production use.

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
       SQLite database
              ▲
     Twilio SMS / Voice webhooks
```

- `server.js` contains the HTTP API, conversation routing, booking rules, FAQs, handoff queue, delay notifications, and Twilio-compatible SMS and voice webhooks.
- `database.js` initializes SQLite tables and saves schedule, message, conversation, consent, handoff, and audit data.
- `client.js`, `index.html`, and `styles.css` provide the responsive staff dashboard and chat simulator.
- `data.js` holds simulated doctors, departments, appointments, initial activity, and hospital-managed FAQ content.
- `test/receptionist.test.js` exercises the core scheduling, safety, escalation, FAQ, opt-out, and webhook flows.

## Conversation flows

1. **Book:** The patient names a specialty. The agent selects the matching doctor, checks a free demo slot, creates a confirmed appointment, and returns the appointment ID. Staff can also book from **New appointment**.
   **Phone:** Twilio Voice calls enter `/api/twilio/voice`; callers choose booking, say their name and specialty, hear a demo availability slot, then confirm by speech or keypad. The slot uses simulated demo dates.
   **Video/demo recording:** Select **Call demo** on the dashboard. The browser provides a call-style interface that speaks when browser speech synthesis is available, listens when browser speech recognition is available, and otherwise accepts typed turns. A confirmed demo booking is stored in SQLite and appears in the dashboard schedule.
2. **Cancel/reschedule:** The demo can modify an existing appointment matched to the current demo phone. If it cannot establish that match, it asks for an appointment ID instead of revealing details. The schedule frees cancelled slots. The chat simulator intentionally uses a shared demo identity, so use separate phone identifiers when exercising these flows through the API.
3. **Delay update:** Staff select a doctor, date, and delay. One notice is recorded per affected non-cancelled appointment, and identical repeats are deduplicated.
4. **Facility FAQ:** Replies are grounded in the fixed entries in `data.js`. Unknown questions receive an uncertainty response and are placed in the human handoff queue.
5. **Clinical and emergency safety:** Clinical questions are redirected to a clinician. Emergency keywords return the demo emergency line and 112, and add a staff handoff. Replace the example emergency number and verify response wording with the hospital before use.
6. **Opt-out:** `STOP` suppresses further replies for that phone; `START` restores them.
7. **Human handoff:** Explicit requests, emergencies, and unsupported questions create a queue item containing a concise transcript summary. Staff can mark a handoff resolved from the dashboard.

Every response identifies the service as an automated assistant. This demo uses simple keyword rules for predictable behavior; it is not an LLM and does not claim to interpret all languages, typos, or free-form intent reliably.

## Phone and messaging setup

The app includes a Twilio trial number configured for voice: `+1 229 663 4470`. It uses an English (India) speech and keypad flow to offer a doctor and available slot; confirm with “yes” or press 1 to save the appointment. Trial call features and calling region restrictions apply. To run your own deployment, expose the voice-only gateway over HTTPS. Set `TWILIO_PHONE_NUMBER`, `PUBLIC_BASE_URL`, and a random `VOICE_GATEWAY_TOKEN` (at least 32 characters) in the ignored `.env.local` file. Run the dashboard with `npm start`, the voice gateway with `npm run voice-gateway`, and a public tunnel to `http://localhost:3001`. Configure the Twilio voice webhook to the public `/voice/<VOICE_GATEWAY_TOKEN>/api/twilio/voice` route. The gateway only forwards Twilio call webhooks; it does not expose the dashboard or patient APIs.

```text
POST https://YOUR_PUBLIC_HOST/api/twilio/voice
```

`GET /api/health` reports whether the phone line is configured without exposing credentials. Completed phone bookings are recorded in the SQLite schedule and dashboard. The included Cloudflare quick tunnel is for short demos; its public URL changes when restarted, so update the Twilio webhook each time. Before real patient use, add Twilio signature validation, authenticated staff access, validated identity, encrypted production data storage, delivery callbacks, retries, rate limiting, and healthcare privacy/security review.

## Configuration and next production steps

- Edit simulated doctors, departments, FAQ knowledge, and sample appointments in `data.js`.
- The dashboard's reminder cards are demonstration metrics; a real reminder scheduler and delivery adapter are not wired yet.
- The local demo uses SQLite in `data/proactive-care.sqlite`. Use an encrypted, access-controlled production database, backup process, and retention policy before production.
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
