# ecycle-ecollosseum
> A mobile-first e-waste management platform for scanning, tracking, and recycling electronic devices to promote circular economy practices.

## 🧭 At a Glance
- **What it is:** A React Native/Expo application for identifying electronic waste and locating drop-off points.
- **What problem it solves:** Reduces environmental impact by simplifying the identification and proper disposal of obsolete electronics.
- **Who uses it:** Environmentally conscious consumers and local e-waste collection centers.
- **Complexity level:** Intermediate.
- **Best way to explore:** Run `npx expo start` and navigate the `app/(tabs)` directory to see the primary user flow.

## 💡 Why This Exists
Electronic waste is one of the fastest-growing waste streams globally, yet consumers often lack the knowledge or convenience to recycle devices properly. This project bridges the gap between identifying a device and finding a physical location to dispose of it.

The project leverages modern mobile capabilities—specifically camera integration and AI—to automate the identification of hardware. By combining a scanner with a location-based drop-off system, it transforms a tedious chore into a guided, gamified experience.

It serves as a practical implementation of the "Circular Economy" model, providing a template for developers to build sustainable-tech applications using the Expo ecosystem.

## ✨ Key Features
- **AI-Powered Device Scanning** — Uses `@google/generative-ai` to identify electronic devices via camera, reducing manual data entry.
- **Geo-Located Drop-off Points** — Maps integration to find the nearest recycling centers, ensuring users have actionable disposal paths.
- **Device Lifecycle Tracking** — Maintains a history of scanned items in `lib/device-store.ts`, allowing users to monitor their personal recycling impact.
- **Community Engagement** — A dedicated tab for community-driven recycling initiatives, fostering local environmental awareness.
- **Cross-Platform UI** — Built with `expo-router` and `react-native-reanimated` for a consistent experience across iOS and Android.

## 🏗️ Core Architecture
- **System Design Pattern**: Model-View-Controller (MVC) via Expo Router (UI components are decoupled from state management).
- **Data Flow**: Camera input (`app/scanner.tsx`) → AI Analysis (`lib/firebase.ts` or local logic) → State Update (`lib/device-store.ts`) → UI Reflection (`app/(tabs)/index.tsx`).
- **Key Abstractions**: `device-store` (persistence layer), `themed-text/view` (design system abstraction), and `expo-router` (navigation graph).
- **Boundaries & Seams**: Firebase handles authentication and remote data; Google Generative AI handles image-to-text device classification.

## 🛠️ Tech Stack
- **Languages & Frameworks:** TypeScript, React Native, Expo SDK 55.
- **Build & Tooling:** `babel-plugin-react-compiler`, `eslint`, `eas-cli`.
- **Infrastructure:** Firebase (Auth/Database), EAS (Expo Application Services).
- **External Runtime Requirements:** Node.js 18+, Expo Go app (for mobile testing), and a valid Firebase project configuration.

## 📦 Critical Dependencies
- `@google/generative-ai` — Powers the device identification logic; without this, the core "scan-and-identify" feature fails.
- `expo-camera` — Provides hardware access to the device lens; essential for the primary user interaction.
- `@gorhom/bottom-sheet` — Manages complex UI overlays for device details; critical for the mobile UX.
- `firebase` — The backend-as-a-service provider for user identity and data persistence.

## 🗂️ Project Structure
```text
/app            → File-based routing for screens and layouts
/assets         → Static media, icons, and branding images
/components     → Reusable UI primitives and layout wrappers
/constants      → Theme definitions and configuration constants
/hooks          → Custom React hooks for theme and state management
/lib            → Business logic, API clients, and state stores
/scripts        → Utility scripts for project maintenance
/.vscode        → Editor-specific settings for consistent linting
```
*Mental Map: To understand this project, think of it as a "Shazam for E-Waste," where the camera is the input and the recycling center is the destination.*

## 🔍 Where to Start Reading

**For engineers:**
- `lib/device-store.ts` — *The source of truth for application state and data persistence.*
- `app/scanner.tsx` — *The integration point between hardware (camera) and AI logic.*
- `app/(tabs)/_layout.tsx` — *The navigation architecture defining the app's primary structure.*

**For learners:**
- `components/themed-text.tsx` — *A great example of how to build a consistent design system.*
- `app/(tabs)/index.tsx` — *The entry point for the dashboard; shows how to compose components.*
- `hooks/use-theme-color.ts` — *Teaches how to handle dynamic styling in React Native.*

## 🚀 Getting Started

### Prerequisites
- Node.js (LTS version)
- Expo Go app installed on your physical device
- A Firebase project (for backend services)

### Setup
```bash
# Install dependencies
npm install
# Start the development server
npx expo start
```

### Verify It's Working
Run `npx expo start` and scan the QR code with your phone. You should see the tabbed interface load with the "Scanner" tab active.

## 🤝 How to Contribute

**Jump right in:**
- [Open in GitHub Codespaces](https://codespaces.new/pranshu-yadav-git/ecycle-ecollosseum)

**Contribution path for first-timers:**
1. Improve documentation in `README.md`.
2. Add unit tests for `lib/device-store.ts`.
3. A good PR includes a clear description of the UI change or bug fix and follows the existing TypeScript patterns.

**Testing & linting:**
```bash
npm run lint
```

## 🐛 Active Good First Issues
None currently open.

## 📚 What You'll Learn
- **Mobile AI Integration:** How to pipe camera frames into LLMs.
- **State Persistence:** Managing local data with `async-storage` via custom stores.
- **Universal UI:** Building adaptive interfaces that work on both iOS and Android.
- **Navigation Patterns:** Mastering file-based routing with Expo Router.

## 🤖 Machine-Readable Metadata [AI-READABLE]
```yaml
repo: pranshu-yadav-git/ecycle-ecollosseum
description: "E-waste management and recycling identification app"
stars: 0
forks: 0
open_issues: 1
language: "TypeScript"
license: "none"
architecture_pattern: "MVC/Router-based"
entry_point: "app/_layout.tsx"
external_dependencies_required: true
test_command: "npm run lint"
ci_present: false
```

## 📊 Quick Stats [AI-READABLE]
| Metric | Value |
|--------|-------|
| ⭐ Stars | 0 |
| 🍴 Forks | 0 |
| 🐛 Open Issues & PRs | 1 |
| 💬 Primary Language | TypeScript |
| ⚖️ License | N/A |
