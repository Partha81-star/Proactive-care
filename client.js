const $ = (selector) => document.querySelector(selector);
let state;
const initials = (name) => name.split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase();
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
async function api(path, options = {}) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong.");
  return result;
}

function renderAppointments() {
  const list = state.appointments.filter((item) => item.date === state.simulatedToday);
  $("#appointmentCount").textContent = list.length;
  $("#appointmentNavCount").textContent = state.appointments.length;
  $("#appointmentRows").innerHTML = list.slice(0, 5).map((item) => {
    const doctor = state.doctors.find((candidate) => candidate.id === item.doctorId);
    return `<tr><td class="patient-cell">${escapeHtml(item.patient)}</td><td class="doctor-cell">${escapeHtml(doctor?.name || "Care team")}</td><td class="time-cell">${escapeHtml(item.time)}</td><td><span class="status ${item.status.toLowerCase()}">${escapeHtml(item.status)}</span></td><td><button class="row-menu" data-appointment="${escapeHtml(item.id)}" title="Update appointment">···</button></td></tr>`;
  }).join("") || `<tr><td colspan="5">No appointments for this day.</td></tr>`;
  $("#metricAppointments").textContent = state.metrics.todayAppointments;
}
function renderActivity() {
  const iconFor = (item) => item.channel === "Phone" ? "phone" : item.channel === "WhatsApp" ? "chat" : "web";
  $("#activityList").innerHTML = state.messages.slice(0, 4).map((item) => `<div class="activity-item"><span class="activity-icon ${iconFor(item)}">${item.channel === "Phone" ? "◉" : item.channel === "WhatsApp" ? "◌" : "▧"}</span><div class="activity-copy"><b>${escapeHtml(item.patient)} <span style="font-weight:400;color:#9da7a8">· ${escapeHtml(item.channel)}</span></b><p>${escapeHtml(item.body)}</p></div><time>${escapeHtml(item.time)}</time></div>`).join("");
}
function renderHandoffs() {
  const waiting = state.escalations.filter((item) => item.status !== "Resolved");
  $("#handoffNavCount").textContent = waiting.length;
  $("#metricHandoffs").textContent = waiting.length;
  $("#handoffList").innerHTML = waiting.slice(0, 2).map((item) => `<div class="handoff-item"><span class="handoff-avatar">${initials(item.patient)}</span><div class="handoff-copy"><b>${escapeHtml(item.patient)}</b><small>${escapeHtml(item.reason)} · ${escapeHtml(item.summary)}</small></div><span class="wait-badge">${escapeHtml(item.status)}</span><button class="row-menu resolve-handoff" data-id="${escapeHtml(item.id)}" aria-label="Resolve handoff">✓</button></div>`).join("") || `<div class="handoff-item"><span class="handoff-copy"><b>All caught up</b><small>No patients are waiting for a staff member.</small></span></div>`;
}
function renderDoctors() {
  $("#doctorList").innerHTML = state.doctors.map((doctor) => `<article class="doctor-card"><div class="doctor-card-top"><span class="doctor-photo">${initials(doctor.name)}</span><b>${escapeHtml(doctor.name)}</b></div><p>${escapeHtml(doctor.specialty)}</p><span class="doctor-status">Accepting visits</span></article>`).join("");
}
function render() {
  renderAppointments(); renderActivity(); renderHandoffs(); renderDoctors();
  $("#metricReminders").innerHTML = `${state.metrics.remindersSent} <small>/ 24</small>`;
  $("#conversationTotal").textContent = `${state.metrics.activeConversations} conversation${state.metrics.activeConversations === 1 ? "" : "s"}`;
  const date = new Date(`${state.simulatedToday}T12:00:00`);
  $("#todayLabel").textContent = new Intl.DateTimeFormat("en-IN", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date);
  const eyebrow = new Intl.DateTimeFormat("en-IN", { weekday: "long", month: "long", day: "2-digit" }).format(date).toUpperCase();
  document.querySelector(".welcome-row .eyebrow").innerHTML = `<span class="live-dot"></span> ${escapeHtml(eyebrow)}`;
}
async function refresh() { state = await api("/api/dashboard"); render(); }

function openModal(title, eyebrow, markup) {
  $("#modalTitle").textContent = title; $("#modalEyebrow").textContent = eyebrow;
  $("#modalBody").innerHTML = markup; $("#modalBackdrop").classList.remove("hidden");
  const focus = $("#modalBody input, #modalBody textarea, #modalBody select"); if (focus) focus.focus();
}
function closeModal() { $("#modalBackdrop").classList.add("hidden"); $("#modalBody").innerHTML = ""; }
function optionsForDoctors() { return state.doctors.map((doctor) => `<option value="${escapeHtml(doctor.id)}">${escapeHtml(doctor.name)} · ${escapeHtml(doctor.specialty)}</option>`).join(""); }
function showAppointmentForm() {
  openModal("New appointment", "SCHEDULING", `<form id="appointmentForm"><div class="form-grid"><div class="field"><label for="patientName">Patient name</label><input id="patientName" name="patient" placeholder="Full name" required /></div><div class="field"><label for="patientPhone">Phone number</label><input id="patientPhone" name="phone" placeholder="+91 98765 43210" required /></div><div class="field full"><label for="appointmentDoctor">Doctor / specialty</label><select id="appointmentDoctor" name="doctorId">${optionsForDoctors()}</select></div><div class="field"><label for="appointmentDate">Date</label><input id="appointmentDate" name="date" type="date" value="${state.simulatedToday}" required /></div><div class="field"><label for="appointmentTime">Available time</label><select name="time"><option>09:00</option><option>09:30</option><option>10:00</option><option>10:30</option><option>11:00</option><option>11:30</option><option>12:00</option><option>14:00</option><option>14:30</option><option>15:00</option><option>15:30</option><option>16:00</option></select></div><div class="field full"><label for="appointmentReason">Reason for visit</label><input id="appointmentReason" name="reason" placeholder="e.g. General check-up" /></div></div><button class="modal-submit">Confirm appointment</button><p class="form-note">Only the minimum booking details are required. Available slots are checked when you confirm.</p><div id="formError" class="form-note" style="color:#bd645b"></div></form>`);
  $("#appointmentForm").addEventListener("submit", async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); try { await api("/api/appointments", { method: "POST", body: JSON.stringify(data) }); await refresh(); openModal("Appointment confirmed", "BOOKING COMPLETE", `<div class="success-message">The appointment has been added to the schedule and audit log.</div><button class="modal-submit" id="doneButton">Done</button>`); $("#doneButton").onclick = closeModal; } catch (error) { $("#formError").textContent = error.message; } });
}
function showChat() {
  openModal("Conversation simulator", "PATIENT MESSAGING", `<div class="chat-box"><div class="chat-header"><span class="assistant-logo">✳</span><span><b>Proactive Care Assistant</b><small><i style="color:#43be8e">●</i> Automated receptionist · Online</small></span></div><div class="chat-messages" id="chatMessages"><div class="bubble bot">Hi! I’m the Proactive Care virtual receptionist. How can I help you today?<small>Automated assistant</small></div></div><form id="chatForm" class="chat-compose"><select class="channel-select" name="channel"><option>Web chat</option><option>WhatsApp</option><option>Phone</option></select><input name="message" placeholder="Ask about appointments, directions..." required autocomplete="off"/><button aria-label="Send">➤</button></form></div><p class="simulator-note">Demo mode · Try “book cardiology”, “where is parking?”, “reschedule”, or “I want to speak to a person”.</p>`);
  const transcript = [{ role: "assistant", text: "Hi! I’m the Proactive Care virtual receptionist. How can I help you today?" }];
  const messages = $("#chatMessages");
  $("#chatForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); const text = data.message.trim(); if (!text) return;
    const patientBubble = document.createElement("div"); patientBubble.className = "bubble user"; patientBubble.textContent = text; messages.append(patientBubble); form.message.value = "";
    try { const result = await api("/api/chat", { method: "POST", body: JSON.stringify({ patient: "Demo Patient", phone: "demo", channel: data.channel, message: text }) });
      if (result.reply) { const replyBubble = document.createElement("div"); replyBubble.className = "bubble bot"; replyBubble.textContent = result.reply; messages.append(replyBubble); }
      transcript.push({ role: "patient", text }, { role: "assistant", text: result.reply }); messages.scrollTop = messages.scrollHeight; await refresh();
    } catch { const replyBubble = document.createElement("div"); replyBubble.className = "bubble bot"; replyBubble.textContent = "I couldn’t send that just now. Please try again."; messages.append(replyBubble); }
  });
}
function showDoctors() {
  openModal("Doctors & departments", "CARE TEAM", `<div>${state.doctors.map((doctor) => { const department = state.departments.find((item) => item.name === doctor.department); return `<div class="doctor-manage-row"><span class="doctor-photo">${initials(doctor.name)}</span><span><b>${escapeHtml(doctor.name)} · ${escapeHtml(doctor.specialty)}</b><small>${escapeHtml(department?.name || doctor.department)} · ${escapeHtml(department?.floor || "Hospital campus")} · ${escapeHtml(department?.hours || "By appointment")}</small></span></div>`; }).join("")}</div>`);
}
function showKnowledge() {
  openModal("Hospital knowledge base", "GROUNDED ANSWERS", `<p class="form-note" style="margin:0 0 10px">Answers come only from hospital-managed information. The demo safely hands off questions that are not covered.</p><div>${state.departments.map((department) => `<div class="kb-row"><span class="quick-icon">▧</span><span><b>${escapeHtml(department.name)}</b><small>${escapeHtml(department.floor)} · ${escapeHtml(department.hours)}</small></span></div>`).join("")}<div class="kb-row"><span class="quick-icon delay-icon">◷</span><span><b>Visitor information</b><small>Hours: 10 AM–12 PM and 4–7 PM · Parking: basement · Bring a photo ID and appointment confirmation.</small></span></div><div class="kb-row"><span class="quick-icon audit-icon">♢</span><span><b>Insurance & billing</b><small>Major insurance accepted; billing desk accepts cash, cards, and UPI. Plan-specific coverage is verified by staff.</small></span></div></div><p class="form-note">For this demo, knowledge entries are maintained in data.js. A persistent staff editor is planned for the next iteration.</p>`);
}
function showDelayForm() {
  openModal("Report a doctor delay", "PATIENT UPDATES", `<form id="delayForm"><div class="delay-hint">All scheduled, non-cancelled patients for the selected doctor and date will receive one update. Repeating the same update will not send duplicates.</div><div class="form-grid"><div class="field full"><label for="delayDoctor">Doctor</label><select id="delayDoctor" name="doctorId">${optionsForDoctors()}</select></div><div class="field"><label for="delayDate">Date</label><input id="delayDate" name="date" type="date" value="${state.simulatedToday}" required /></div><div class="field"><label for="delayMinutes">Estimated delay (minutes)</label><input id="delayMinutes" name="delayMinutes" type="number" min="1" max="480" value="30" required /></div></div><button class="modal-submit">Notify affected patients</button><div id="delayError" class="form-note"></div></form>`);
  $("#delayForm").addEventListener("submit", async (event) => { event.preventDefault(); try { const data = Object.fromEntries(new FormData(event.currentTarget)); const result = await api("/api/delays", { method: "POST", body: JSON.stringify(data) }); await refresh(); $("#delayError").textContent = `Sent one update to ${result.notified} patient${result.notified === 1 ? "" : "s"}.`; } catch (error) { $("#delayError").textContent = error.message; } });
}
function showAudit() {
  openModal("Assistant activity", "AUDIT LOG", `<div>${state.audit.slice(0, 15).map((item) => `<div class="audit-row"><span class="quick-icon audit-icon">▤</span><span><b>${escapeHtml(item.action)}</b><small>${escapeHtml(item.detail)}</small></span><time class="audit-time">${escapeHtml(item.time)}</time></div>`).join("")}</div>`);
}
function showAllAppointments() {
  openModal("All appointments", "SCHEDULE", `<div>${state.appointments.slice(0, 20).map((item) => { const doctor = state.doctors.find((candidate) => candidate.id === item.doctorId); return `<div class="audit-row"><span class="handoff-avatar">${initials(item.patient)}</span><span><b>${escapeHtml(item.patient)} · ${escapeHtml(item.status)}</b><small>${escapeHtml(doctor?.name || "Care team")} · ${escapeHtml(item.date)} at ${escapeHtml(item.time)} · ${escapeHtml(item.reason)}</small></span></div>`; }).join("")}</div>`);
}

$("#newAppointment").onclick = showAppointmentForm;
$("#openChat").onclick = showChat; $("#chatAssistant").onclick = showChat;
$("#viewDoctors").onclick = showDoctors; $("#knowledgeLink").onclick = showKnowledge;
$("#delayAction").onclick = showDelayForm; $("#auditAction").onclick = showAudit;
$("#allAppointments").onclick = showAllAppointments;
$("#closeModal").onclick = closeModal;
$("#modalBackdrop").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeModal(); });
$("#appointmentRows").addEventListener("click", async (event) => { const button = event.target.closest("[data-appointment]"); if (!button) return; const item = state.appointments.find((candidate) => candidate.id === button.dataset.appointment); if (!item) return; const next = item.status === "Cancelled" ? "Confirmed" : "Cancelled"; await api("/api/appointments/status", { method: "POST", body: JSON.stringify({ id: item.id, status: next }) }); await refresh(); });
$("#handoffList").addEventListener("click", async (event) => { const button = event.target.closest(".resolve-handoff"); if (!button) return; await api("/api/escalations/status", { method: "POST", body: JSON.stringify({ id: button.dataset.id, status: "Resolved" }) }); await refresh(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });
refresh().catch((error) => { console.error(error); });
