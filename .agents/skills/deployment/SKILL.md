---
name: deployment
description: Guides the build, packaging, OTA updates, and store/web submission workflows for the SafeHer-AI Expo project using EAS or static web export.
---

# SafeHer-AI Deployment Guide

Use this skill to guide the build, update, and deployment processes of the SafeHer-AI mobile and web application. This project uses Expo (v57.0.0+) and Expo Application Services (EAS).

---

## 1. Environment & Prerequisites Checklist

### Node.js & NVM Setup
Because this is running in a WSL/Linux environment where the Windows Node environment might interfere or local Node is not selected:
1. Always initialize NVM first in terminal runs:
   ```bash
   . ~/.nvm/nvm.sh
   ```
2. Check if a Node version is selected. If not, install and use LTS:
   ```bash
   nvm install --lts && nvm use --lts
   ```
3. Verify that Node is available in WSL:
   ```bash
   node -v
   ```

### EAS CLI Setup
1. Verify if the user is logged into EAS:
   ```bash
   npx eas-cli whoami
   ```
2. If not logged in, ask the user to run `npx eas-cli login` in their terminal. Do not automate credential entry.
3. Check the EAS project link:
   ```bash
   npx eas-cli project:info
   ```
   *Note: The project ID configured in [app.json](file:///home/hema/SafeHer-AI/app.json) is `6a6185fa-7c3e-48b3-86c7-db3edae53a24`.*

---

## 2. EAS Build Workflow

We use EAS Build to build app binaries for iOS and Android. The build profiles are configured in [eas.json](file:///home/hema/SafeHer-AI/eas.json).

### Available Profiles
- `development`: Builds a development client with debug enabled.
- `preview`: Builds a release-like client for internal testing (Ad-Hoc / Internal distribution).
- `production`: Builds the production bundle ready for App Store / Google Play submission.

### Commands
- **Build Android (Production APK/AAB):**
  ```bash
  npx eas-cli build --platform android --profile production
  ```
- **Build iOS (Production IPA):**
  ```bash
  npx eas-cli build --platform ios --profile production
  ```
- **Build All Platforms:**
  ```bash
  npx eas-cli build --platform all --profile production
  ```
- **Build for Staging/Internal testing (Android Preview):**
  ```bash
  npx eas-cli build --platform android --profile preview
  ```

---

## 3. Over-the-Air (OTA) Updates (EAS Update)

If only JS/Assets have changed (no changes to Native/Expo plugins or `package.json` dependencies), you can deploy changes immediately to users without rebuilding binaries.

1. Publish updates to the `main` branch:
   ```bash
   npx eas-cli update --branch main --message "Detailed explanation of the changes"
   ```
2. View publication history:
   ```bash
   npx eas-cli update:view
   ```

---

## 4. App Store Submission (EAS Submit)

To submit already built binaries directly to the App Store or Google Play Store:

- **Submit Android:**
  ```bash
  npx eas-cli submit --platform android
  ```
- **Submit iOS:**
  ```bash
  npx eas-cli submit --platform ios
  ```
- **Submit All Platforms:**
  ```bash
  npx eas-cli submit --platform all
  ```

---

## 5. Web Export & Deployment

If building/deploying for web, the app can be compiled to static HTML/CSS/JS.

1. Export the web build:
   ```bash
   npx expo export --platform web
   ```
   *Note: This command generates static assets in the `/home/hema/SafeHer-AI/dist` directory.*
2. Test the exported web app locally:
   ```bash
   npx serve dist
   ```
3. Deployment target configurations:
   - **Vercel:** Run `npx vercel deploy --prod` within the project root to deploy the `dist` directory.
   - **Netlify:** Run `npx netlify deploy --dir=dist --prod`.
   - **S3 / Static Hosts:** Upload the contents of `/home/hema/SafeHer-AI/dist` to the static hosting bucket.
