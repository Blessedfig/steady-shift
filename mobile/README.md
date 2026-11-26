# Steady Shift on phones (test)

There are two ways to put the test app on a phone. Both open the live test app at
https://blessedfig.github.io/steady-shift/app/, so every update to the app shows up without reinstalling.

## 1. Home-screen app (iPhone and Android, nothing to set up)

- **iPhone:** open the test app link in **Safari**, tap Share, then **Add to Home Screen**.
- **Android:** open the link in **Chrome**, tap **Install** on the home screen card (or menu ⋮ > Add to Home screen / Install app).

Open it from the new icon and sign in once with the **code** from the sign-in email. A link tapped in the
email opens in the browser, not in the home-screen app, which is why the app takes a code.

## 2. Android app file (APK)

Icons and splash screens are pre-rendered in `resources/res`. The GitHub Action `.github/workflows/android-test.yml` builds an installable test APK whenever `mobile/` changes
(or from Actions > "Android test build" > Run workflow). Download it on the phone from:

https://github.com/Blessedfig/steady-shift/releases/download/android-test/steady-shift-test.apk

Open the file and allow "install unknown apps" for the browser when Android asks. It is a debug test build,
not a Play Store release.

## iPhone app (later, needs Christian)

A real iPhone app for TestFlight needs a paid Apple Developer Program membership ($99 a year), signing
certificates, and a Mac or a cloud Mac build service. The project is ready for it (`npm ci && npx cap add ios`
in this folder). Until then, the home-screen app above is the iPhone test path.

## Sign-in code (one setting, needs Christian)

Supabase project "owner-desk" > Authentication > Emails > **Magic Link** template: add the code so the email has both
the link and the code, for example:

```
<p>Or type this code in the app: <b>{{ .Token }}</b></p>
```

Save. Nothing else changes for the desk.
