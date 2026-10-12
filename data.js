export const doctors = [
  { id: "D-101", name: "Dr. Aisha Mehta", specialty: "Cardiology", department: "Heart & Vascular", available: true },
  { id: "D-102", name: "Dr. Rohan Iyer", specialty: "Dermatology", department: "Skin & Wellness", available: true },
  { id: "D-103", name: "Dr. Kavya Nair", specialty: "Pediatrics", department: "Children’s Health", available: true },
  { id: "D-104", name: "Dr. Arjun Rao", specialty: "Orthopedics", department: "Bone & Joint", available: true },
  { id: "D-105", name: "Dr. Neha Shah", specialty: "General Medicine", department: "Primary Care", available: true }
];

export const departments = [
  { id: "heart", name: "Heart & Vascular", floor: "Floor 2 · East Wing", hours: "Mon–Sat, 9:00 AM–5:00 PM" },
  { id: "skin", name: "Skin & Wellness", floor: "Floor 3 · North Wing", hours: "Mon–Sat, 10:00 AM–6:00 PM" },
  { id: "children", name: "Children’s Health", floor: "Floor 1 · West Wing", hours: "Mon–Sat, 8:00 AM–4:00 PM" },
  { id: "bone", name: "Bone & Joint", floor: "Floor 2 · West Wing", hours: "Mon–Fri, 9:00 AM–5:00 PM" },
  { id: "primary", name: "Primary Care", floor: "Floor 1 · East Wing", hours: "Mon–Sat, 8:00 AM–8:00 PM" }
];

export const initialAppointments = [
  { id: "APT-2401", patient: "Priya Sharma", phone: "+91 98765 43210", doctorId: "D-101", date: "2026-10-12", time: "10:30", status: "Confirmed", reason: "Heart check-up", source: "Phone" },
  { id: "APT-2402", patient: "Arjun Patel", phone: "+91 98765 43211", doctorId: "D-103", date: "2026-10-12", time: "11:00", status: "Confirmed", reason: "Child wellness visit", source: "WhatsApp" },
  { id: "APT-2403", patient: "Meera Kapoor", phone: "+91 98765 43212", doctorId: "D-102", date: "2026-10-12", time: "11:30", status: "Pending", reason: "Skin consultation", source: "Web chat" },
  { id: "APT-2404", patient: "Kabir Singh", phone: "+91 98765 43213", doctorId: "D-104", date: "2026-10-12", time: "12:00", status: "Confirmed", reason: "Knee pain consultation", source: "Phone" },
  { id: "APT-2405", patient: "Ananya Das", phone: "+91 98765 43214", doctorId: "D-105", date: "2026-10-13", time: "09:30", status: "Confirmed", reason: "General check-up", source: "WhatsApp" },
  { id: "APT-2406", patient: "Vikram Joshi", phone: "+91 98765 43215", doctorId: "D-101", date: "2026-10-13", time: "10:00", status: "Confirmed", reason: "Follow-up visit", source: "Phone" },
  { id: "APT-2407", patient: "Sara Khan", phone: "+91 98765 43216", doctorId: "D-102", date: "2026-10-14", time: "14:00", status: "Confirmed", reason: "Skin check-up", source: "Web chat" },
  { id: "APT-2408", patient: "Dev Malhotra", phone: "+91 98765 43217", doctorId: "D-103", date: "2026-10-14", time: "14:30", status: "Cancelled", reason: "Child wellness visit", source: "Phone" }
];

export const initialMessages = [
  { id: "MSG-8001", patient: "Priya Sharma", channel: "Phone", direction: "Outbound", body: "Appointment reminder sent for 12 Oct at 10:30 AM.", time: "09:12", status: "Delivered" },
  { id: "MSG-8002", patient: "Arjun Patel", channel: "WhatsApp", direction: "Inbound", body: "Can I book a visit for my child?", time: "09:08", status: "Received" },
  { id: "MSG-8003", patient: "Meera Kapoor", channel: "Web chat", direction: "Outbound", body: "Hi Meera, confirming your skin consultation. Reply YES to confirm.", time: "08:56", status: "Delivered" },
  { id: "MSG-8004", patient: "Kabir Singh", channel: "Phone", direction: "Inbound", body: "What floor is orthopedics on?", time: "08:42", status: "Received" }
];

export const knowledge = [
  { keywords: ["visiting hour", "visit patients", "visiting time"], answer: "Visiting hours are 10:00 AM–12:00 PM and 4:00 PM–7:00 PM every day." },
  { keywords: ["parking", "park", "car"], answer: "Visitor parking is available in the basement. The first 30 minutes are complimentary." },
  { keywords: ["insurance", "insurer", "cashless"], answer: "We accept major insurance providers. Please bring your insurance card so our billing desk can verify your specific plan." },
  { keywords: ["document", "bring", "id proof", "what should i carry"], answer: "Please bring a photo ID, your appointment confirmation, and any previous reports relevant to your visit." },
  { keywords: ["address", "direction", "location", "where is hospital"], answer: "Proactive Care Hospital is at 14 Lakeview Road, Bengaluru 560001. The main entrance is on Lakeview Road." },
  { keywords: ["billing", "payment", "pay", "bill"], answer: "The billing desk on the ground floor accepts cash, cards, and UPI. For a bill estimate, I can connect you with the billing team." },
  { keywords: ["prepare", "fasting", "test preparation", "before my test"], answer: "Preparation depends on the test. Tell me the test name and I can check our instructions, or I can connect you with the lab team." },
  { keywords: ["floor", "department", "where is", "located"], answer: "Heart & Vascular: Floor 2 East Wing. Skin & Wellness: Floor 3 North Wing. Children’s Health: Floor 1 West Wing. Bone & Joint: Floor 2 West Wing. Primary Care: Floor 1 East Wing." },
  { keywords: ["doctor", "available", "specialist", "appointment", "book", "schedule"], answer: "I can help book a visit. Which specialty do you need: cardiology, dermatology, pediatrics, orthopedics, or general medicine?" }
];
