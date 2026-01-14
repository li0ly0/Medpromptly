# MedPromptly

MedPromptly is a modern, real-time medication management system designed to bridge the communication gap between patients and their support network.

---

## The Problem
Caregiving is often stressful and prone to human error. Families face three major hurdles:
1. **The Forgetfulness Gap:** Patients (especially the elderly) may forget a dose or, worse, double-dose by accident.
2. **The Anxiety Loop:** Guardians often worry and send repetitive "Did you take your pill?" messages, leading to "notification fatigue."
3. **Coordination Chaos:** If multiple guardians are involved, it's often unclear who is currently assisting the patient, leading to duplicate efforts or critical misses.

**MedPromptly solves this** by providing a synchronized "Source of Truth" where every dose taken is logged instantly for the entire current guardians to see.

---

## Technical Stack
- **Frontend:** React 19 (ES6+ Modules)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Modern Glassmorphism UI)
- **Database:** Neon Database (Serverless PostgreSQL)
- **Icons:** Font Awesome 6
- **Auth:** Custom secure SHA-256 password hashing via Web Crypto API

---

## Key Features

### 1. Role-Based Experience
- **Patients:** Get a streamlined, distraction-free checklist. They receive a unique "Care Code" to invite family members.
- **Guardians:** Can manage medication schedules, dosages, and frequencies. They see real-time progress of their linked patient.

### 2. Intelligent "Lock" Logic
The checklist isn't just a list; it’s a smart schedule:
- **Locked State:** Buttons are disabled until the scheduled time.
- **Active State:** The "Done" button activates exactly when the dose is due.
- **Overdue State:** If 30 minutes pass without action, the UI shifts to high-visibility "Rose" (red) alerts.
- **Completed:** Once logged, the dose shows exactly *who* confirmed it and *when*.

### 3. Family Care Circle
- **Real-Time Sync:** When a patient clicks "Done," every guardian’s dashboard updates instantly via the Neon Database layer.
- **Identity Verification:** Profile photos and unique names ensure you know exactly who is helping at any given moment.

### 4. High-Priority Protocols
- Visual indicators for life-saving medications (Heart meds, etc.) vs. standard supplements.

---

## How to Run Locally

1. **Clone the repository** to your local machine.
2. **Setup Environment:**
   - Ensure you have a [Neon Database](https://neon.tech) connection string.
   - The app looks for `DATABASE_URL` in the environment or a fallback in the storage service.
3. **Serve the files:**
   - Since this project uses ES6 modules and an import map, you can serve it using any local static server.
   - Example using `npx`:
     ```bash
     npx serve .
     ```
4. **Access the App:** Open `http://localhost:3000` (or the port provided) in your browser.

---

## Future Improvements
- **Multi-Patient Tracking:** Allow professional caregivers or "Sandwich Generation" parents to track multiple patients (e.g., both an aging parent and a child) from a single unified dashboard.
- **Pill Photo Uploads:** Allow guardians to snap a photo of the physical pill so patients can recognize it by sight rather than just chemical names.
- **Automated Email Escalation:** If a "High Priority" med is overdue for more than 60 minutes, trigger an automated email or SMS to the entire Care Circle.

---

## 🔗 Live Demo
[View Live Demo](https://medpromptly.beverlycionrespecia.workers.dev/)
