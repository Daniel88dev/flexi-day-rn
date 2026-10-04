# Setting up Google, Microsoft and Apple sign-in for the phone

The phone signs in with a native id token: Google through the Google Sign-In SDK, Microsoft through
`expo-auth-session` as a plain OpenID Connect client, Apple through `expo-apple-authentication`. All
three end in better-auth's own `authClient.signIn.social({ provider, idToken })` against the backend,
and the web gains Apple next to Google and Microsoft. This document is the portal and wiring side of
that: every click in Google Cloud, the Entra admin centre and the Apple Developer portal, in an order
that avoids rework, with the steps you get one shot at marked as such.

The code lands on `feat/native-social-sign-in` in `flexi-day-be`, `flexi-day-rn` and `flexi-day`.
Env variable and Terraform names below for Apple follow the backend's proposal and the Microsoft
pattern already in `flexi-day-be/.env.example` and `flexi-day-be/terraform/variables.tf`; Google and
Microsoft add nothing on the backend. Facts come from the three research notes linked at the end.
Where a research note left something open, this document says so rather than guessing, and the
walk-through confirms it in the portal.

## What already exists

| Where           | State                                                                                                                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend         | Google and Microsoft registered in `buildSocialProviders` (`src/utils/socialProviders.ts`), both with `emailVerified: false` forced; `POST /api/auth/sign-in/social` answers them; Apple not yet                                  |
| Google Cloud    | One project with a Web application OAuth client whose id is `GOOGLE_CLIENT_ID`; the consent screen branding belongs to that project                                                                                               |
| Entra           | One app registration, account types "any organizational directory and personal Microsoft accounts" (`MICROSOFT_TENANT_ID=common`), a Web platform with the backend callback, a client secret, the `email` optional id-token claim |
| Apple Developer | Team `S6FC47MMXJ`, Individual, account `daniel.hrynusiw@gmail.com`; App ID `com.flexiday.app` with Push Notifications and Associated Domains; no Sign in with Apple, no Services ID, no key                                       |
| Email           | `flexi-day.com` is an SES identity with Easy DKIM; the apex SPF record is `v=spf1 include:amazonses.com ~all`; MAIL FROM is SES's own `amazonses.com` subdomain; sender `no-reply@flexi-day.com`                                  |
| Phone           | `scheme: "flexiday"`, `ios.bundleIdentifier: "com.flexiday.app"`, `ios.appleTeamId`, `expo-web-browser` and `expo-crypto` installed; EAS holds the App Store profile ([`releasing.md`](releasing.md))                             |

The backend's trusted origins (`TRUSTED_ORIGINS`, `trusted_origins` in Terraform) list the web
origins and `flexiday://`.

## What the walk-through settled

The portal work ran on 2026-10-04 with the Account Holder. The resulting public values and the
answers to the questions the research left open are folded into the sections below and summarised
here:

| Value                       | Result                                                                         |
| --------------------------- | ------------------------------------------------------------------------------ |
| Google iOS client id        | `456983325414-tt5nktncl12ece3qjrtb043jlc4lia37.apps.googleusercontent.com`     |
| Google iOS URL scheme       | `com.googleusercontent.apps.456983325414-tt5nktncl12ece3qjrtb043jlc4lia37`     |
| Google publishing status    | In production, after verifying `flexi-day.com` in Search Console (section 1.2) |
| Entra redirect URI          | `flexiday://auth` on Mobile and desktop applications; the portal accepts it    |
| Apple Services ID           | `com.flexiday.web` (`APPLE_CLIENT_ID`)                                         |
| Apple Key ID                | `337627W447` (`APPLE_KEY_ID`); the `.p8` is in 1Password                       |
| Apple Services ID domains   | `api.flexi-day.com` and `www.flexi-day.com`                                    |
| Apple App Store requirement | Not enforced by the portal for a TestFlight-only app                           |
| Apple email relay           | `flexi-day.com` and `no-reply@flexi-day.com` registered                        |

The `.p8` key, the only secret, stayed with the user throughout.

## Order of work

1. Google Cloud (section 1). Nothing here invalidates anything; the new client takes up to a few
   hours to propagate, so do it first.
2. Entra (section 2). One redirect URI. No new secret.
3. Apple portal (section 3). The capability on the App ID comes first, because the Services ID and
   the key both hang off a primary App ID that already has it. Then the relay registration.
4. Backend wiring (section 4). Local `.env`, then Terraform.
5. Phone config and the one interactive `eas build` (section 5). Last, because that build syncs the
   App ID's capabilities and replaces the App Store profile, and you want every portal change in
   before it runs once.

Steps you get one shot at:

- The Apple `.p8` key downloads once. Section 3.3.
- The first `eas build` after the capability must run interactively, and it also turns Push
  Notifications off on the App ID unless told not to. Section 5.2.

Everything else can be re-read from a portal later.

## 1. Google Cloud

The backend keeps its one Web client and its env stays as it is. What changes is on the phone: the
Google Sign-In SDK needs an iOS OAuth client of its own to start, and it needs the Web client id as
`webClientId` so the id token's `aud` is the id the backend already checks. The iOS client id ends up
only in the token's `azp`, which better-auth ignores.

### 1.1 Create the iOS client

1. Open the Google Cloud project that owns the Web client whose id is `GOOGLE_CLIENT_ID` in
   production. The iOS client has to sit in the same project; Google groups an app's clients per
   project and branding is per project.
2. Google Auth Platform › Clients › Create client › application type **iOS**.
3. Bundle ID `com.flexiday.app`. Team ID `S6FC47MMXJ` is optional unless App Check is on. App Store
   ID is optional and only exists once the app is published; leave it empty.
4. Leave "Protect your OAuth client from abuse with Firebase App Check" off. It needs App Check work
   in the app, which is a separate decision.
5. Create. Copy the **client id** and the **iOS URL scheme** from the client's page. The scheme is
   the client id reversed, `com.googleusercontent.apps.<id>`. Both stay readable in the console
   later.

Done: client id `456983325414-tt5nktncl12ece3qjrtb043jlc4lia37.apps.googleusercontent.com`, scheme
`com.googleusercontent.apps.456983325414-tt5nktncl12ece3qjrtb043jlc4lia37`.

### 1.2 What stays untouched

- The Web client. Its id stays the token audience. Native clients have no redirect URIs, so
  nothing is added to it.
- Branding. The consent screen shows the project's branding the web already uses. The app name and
  logo appear once the app is verified, same as today.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and the Google Terraform variables.

Google says client changes can take from five minutes to a few hours to apply.

The project's **publishing status** (Google Auth Platform › Audience) is per project and applies to
every client in it, the iOS one included. It was **Testing**, which caps sign-in to the listed test
users and expires consent after seven days. Publishing failed at first with "The website of your
homepage URL 'https://www.flexi-day.com' is not registered to you": Google wants the domain verified
in **Search Console** under the project owner's account. The fix is a `google-site-verification=`
TXT value at the apex. Route 53 keeps one TXT record set per name and the emails repo owns the apex
one, so the token lives in `flexi-day-emails/terraform` as `google_site_verification_txt`, next to
the Entra ownership token. After the apply and **Verify** in Search Console, **Publish app** went
through and the status is **In production**.

### 1.3 What goes into the app

- `npx expo install @react-native-google-signin/google-signin` (16.1.5 at research time, new
  architecture supported, pod `GoogleSignIn ~> 9.0`).
- The config plugin in `app.json`, in its no-Firebase mode. It takes one option and validates that
  it starts with `com.googleusercontent.apps.`:

  ```json
  [
    "@react-native-google-signin/google-signin",
    { "iosUrlScheme": "com.googleusercontent.apps.<id>" }
  ]
  ```

  No `GoogleService-Info.plist`. The plugin appends the scheme to the Info.plist URL schemes and
  adds no `openURL` handler; the library calls that step optional.

- `GoogleSignin.configure({ webClientId, iosClientId })`, with `webClientId` equal to the backend's
  `GOOGLE_CLIENT_ID` and `iosClientId` the new client. Without `iosClientId` the module throws
  "failed to determine clientID". Leave `offlineAccess` off; no nonce, the free package exposes
  none and better-auth checks one only when sent.
- Both ids are public and end up in the binary either way. Whether they live in source or as
  `EXPO_PUBLIC_*` variables is the spec's call. If env, they also go into `.env.example`, the README
  table and the production profile's `env` in `eas.json`, because EAS never sees `.env`.
- Then `LANG=en_US.UTF-8 npm run prebuild` and `npm run ios` or `npm run ios:device`. A URL scheme
  is not a capability, so this does not touch provisioning profiles.

## 2. Entra

The phone is a public client on the **existing** registration. Same application (client) id, same
`common` tenant, same `email` claim. It runs an authorization-code flow with PKCE in
`ASWebAuthenticationSession`, redeems the code without a secret, and hands the id token to the
backend. better-auth 1.7.6 verifies `common` tokens: it fetches
`https://login.microsoftonline.com/common/discovery/v2.0/keys` and checks `iss` against the token's
own `tid`, which is how Microsoft shapes `iss` for work and for personal accounts.

### 2.1 Add the native redirect URI

1. <https://entra.microsoft.com> › Applications › App registrations › the Flexi Day registration ›
   Manage › **Authentication**.
2. **Add a platform** › **Mobile and desktop applications**. Not "iOS / macOS": that platform
   generates `msauth.com.flexiday.app://auth`, the MSAL and broker format, which brings nothing
   without MSAL and would need a second URL scheme in the app. Microsoft files apps "implementing our
   OAuth protocols directly" or using AppAuth under Mobile and desktop.
3. Custom redirect URI:

   ```text
   flexiday://auth
   ```

   No query parameters; registrations that admit personal accounts reject them. Microsoft lists no
   allowed schemes for this platform, but the portal accepted `flexiday://auth` without complaint.

4. **Save.**

### 2.2 What stays untouched

- **Allow public client flows** stays **No**. Microsoft lists only device code, ROPC, Native
  Authentication and Windows Integrated Auth as reasons to turn it on. A PKCE code flow is not on
  the list, and redeeming without a secret works because the redirect URI is on the public-client
  platform.
- The Web platform, its two redirect URIs (production and `localhost:8080`), the client secret, its
  expiry reminder, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` and the
  Terraform variables.
- The implicit-grant checkboxes ("Access tokens", "ID tokens") stay unchecked. With `openid` in
  scope the token endpoint returns `id_token` from a plain code redemption.
- Token configuration. Optional claims apply per application, so the existing `email` claim covers
  the phone's tokens. A token with no email still fails with `USER_EMAIL_NOT_FOUND`, as on the web.

### 2.3 What goes into the app

- `npx expo install expo-auth-session`. No config plugin, no native code, no rebuild; it rides on the
  `flexiday` scheme and on `expo-crypto` and `expo-web-browser`, both installed.
- `useAutoDiscovery("https://login.microsoftonline.com/common/v2.0")`,
  `makeRedirectUri({ scheme: "flexiday", path: "auth" })`, scopes `openid profile email`. Drop
  `offline_access` so Microsoft issues no refresh token; dropping it changes no consent screen.
- PKCE is on by default (S256) but `exchangeCodeAsync` does not send the verifier itself: pass
  `extraParams: { code_verifier: request.codeVerifier }`.
- Send only the id token to the backend, as `idToken: { token }`. Do not send the access token;
  better-auth would spend it on a Graph photo call and store it on the account row.

### 2.4 Release gate

Today's web sign-in never runs better-auth's Microsoft token verifier; the callback decodes the token
it fetched itself. The first phone sign-in is the first time this code meets a real Microsoft token.
Before release, sign in once with a work account and once with a personal account against a dev
backend. If a real token ever fails there, the research note lists the fallbacks; pinning
`MICROSOFT_TENANT_ID` to one directory is not one of them, because it locks out every other
organization on the web too.

### 2.5 Conditional access, a known limitation

Tenants that require an approved client app or an app protection policy block the phone. They also
block Safari on that iPhone, so the limitation is fair to state; such a customer uses the web in
Edge. Compliant-device tenants can admit the app by adding `com.flexiday.app` to the Enterprise SSO
plug-in's allow list. Whether an `ASWebAuthenticationSession` started by the app counts as Safari or
as the app for that check is unconfirmed.

## 3. Apple

Every step here needs the Account Holder; the team is an Individual membership, so that is the
account above. Apple's required role for enabling capabilities, Sign in with Apple, keys and the
email relay is "Account Holder or Admin".

The backend will hold the `.p8` key, not a client secret. Apple caps a client secret JWT at six
months after issue, with nothing longer on offer, so the backend mints one-hour secrets lazily from
the key and re-mints under five minutes left. There is no secret to rotate by hand.

### 3.1 Capability on the App ID

1. <https://developer.apple.com/account> › Certificates, Identifiers & Profiles › Identifiers ›
   `com.flexiday.app`.
2. Tick **Sign in with Apple**, as a primary App ID. **Save**, then **Confirm**.

Changing an App ID makes its provisioning profiles invalid, the App Store profile EAS holds
included. That is why section 5.2 exists. Do the Services ID and the key before you build.

### 3.2 Services ID for the web

1. Identifiers › **+** › **Services IDs** › Continue. Description "Flexi Day", identifier
   `com.flexiday.web`; this identifier is the web flow's `client_id` and becomes `APPLE_CLIENT_ID`.
   It is case sensitive and must differ from the bundle id.
2. On the new Services ID, tick **Sign in with Apple** › **Configure**.
3. Primary App ID: `com.flexiday.app`.
4. Domains and Subdomains: `api.flexi-day.com` and `www.flexi-day.com`. Return URLs:

   ```text
   https://api.flexi-day.com/api/auth/callback/apple
   ```

   Return URLs must be absolute with scheme, host and path. Apple rejects `localhost` and IP
   addresses, so the web flow cannot be tried against a local backend; section 6 covers what can.
   At least one domain is required and no verification file is uploaded. An Individual can register
   up to ten website URLs.

   Apple asks to register "all top-level domains and subdomains that incorporate Sign in with Apple"
   without saying whether the page hosting a plain link counts; `www.flexi-day.com` costs one slot
   and removes the doubt, so it is registered too.

5. **Save**, then **Continue** and **Register**.

Apple's environment guide says web sign-in needs "an existing app in the App Store that uses Sign in
with Apple". The portal did not enforce it: the Services ID registered without a word while Flexi
Day ships through TestFlight only.

### 3.3 The key, once

1. Keys › **+**. Name "Flexi Day Sign in with Apple". Tick **Sign in with Apple** › **Configure** ›
   primary App ID `com.flexiday.app` › Save › Continue › **Register**.
2. Note the **Key ID** on the confirmation page. It becomes `APPLE_KEY_ID`. The live key is
   `337627W447`.
3. **Download** the `.p8`. Apple: "you won't be able to download it again". Put it in 1Password at
   once, next to the APNs key, and keep it out of every repo. The file is a multi-line PEM.

Each primary App ID takes at most two Sign in with Apple keys. That is what makes rotation possible
(section 8).

### 3.4 Private email relay

Users who hide their email get an address at `privaterelay.appleid.com`. Apple forwards mail to it
only from registered sources, and only when the source passes SPF or DKIM.

1. Certificates, Identifiers & Profiles › **Services** › Sign in with Apple for Email Communication ›
   **Configure** › **Email Sources**.
2. Register the domain `flexi-day.com` and the address `no-reply@flexi-day.com` (the `email_from`
   default in `flexi-day-be/terraform/variables.tf`).
3. Read the result Apple shows per source. Both rows show a green **SPF** mark: the registration
   check reads the domain's SPF record, which exists, not a live envelope. At delivery time SPF
   still cannot match, because Apple wants the envelope sender domain to equal the registered
   domain exactly and SES sends with an `amazonses.com` MAIL FROM, this repo setting no custom one.
   DKIM is what lets a message through: `flexi-day.com` has Easy DKIM, and Apple wants the `d=`
   domain to equal the header From domain, which it does. The first hidden-email sign-in is the
   real test; section 7 lists it.

A hidden-email user's confirmation email and every later notification go to the relay address, and
they arrive only once this is done.

### 3.5 What goes into the app

- `npx expo install expo-apple-authentication`.
- In `app.json`: `"usesAppleSignIn": true` under `ios`, and `"expo-apple-authentication"` in
  `plugins`.
- `signInAsync` takes a `nonce` and returns `identityToken`, `authorizationCode`, `email`,
  `fullName` and `user`. `email` and `fullName` are set only on the first authorization, so the
  phone passes them as `idToken.user` on that call; better-auth builds the name from it. Always send
  a nonce; Apple tells servers to verify one, and better-auth accepts the raw value or its SHA-256.

## 4. Backend wiring

Google and Microsoft need nothing. Apple follows the Microsoft shape: one public switch, plain env for
the public values, Secrets Manager for the one secret.

| Env var                       | Terraform variable            | Value                                    | Delivery                                   |
| ----------------------------- | ----------------------------- | ---------------------------------------- | ------------------------------------------ |
| `APPLE_CLIENT_ID`             | `apple_client_id`             | the Services ID identifier (section 3.2) | plain env; empty disables Apple entirely   |
| `APPLE_TEAM_ID`               | `apple_team_id`               | `S6FC47MMXJ`                             | plain env                                  |
| `APPLE_KEY_ID`                | `apple_key_id`                | the Key ID (section 3.3)                 | plain env                                  |
| `APPLE_APP_BUNDLE_IDENTIFIER` | `apple_app_bundle_identifier` | `com.flexiday.app`                       | plain env                                  |
| `APPLE_PRIVATE_KEY`           | `apple_private_key`           | the `.p8` contents                       | sensitive; Secrets Manager, runtime secret |

Plus `https://appleid.apple.com` in `TRUSTED_ORIGINS`. Apple POSTs the web callback (`form_post`),
and better-auth's origin check rejects an untrusted `Origin` on any non-GET request that carries a
cookie. Locally it goes into `.env` by hand; in production `apprunner.tf` appends it whenever
`apple_client_id` is set, so `trusted_origins` stays as it is. Listing it there instead would also
land it in the attachments bucket's CORS rule, which takes every https origin from that variable.

### 4.1 Local

In `flexi-day-be/.env`:

```text
APPLE_CLIENT_ID=<Services ID>
APPLE_TEAM_ID=S6FC47MMXJ
APPLE_KEY_ID=<Key ID>
APPLE_APP_BUNDLE_IDENTIFIER=com.flexiday.app
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
TRUSTED_ORIGINS=http://localhost:3000,flexiday://,https://appleid.apple.com
```

`.env` files carry the PEM with literal `\n`; the backend's parser is specified to accept that form
and real newlines both. Restart the backend. As with Microsoft, the provider registers only when the switch
and the key are both present, so a half-filled block leaves Apple answering 404 rather than crashing
at boot.

### 4.2 Production

In `flexi-day-be/terraform/terraform.tfvars`, the public values only:

```hcl
apple_client_id             = "com.flexiday.web"
apple_team_id               = "S6FC47MMXJ"
apple_key_id                = "337627W447"
apple_app_bundle_identifier = "com.flexiday.app"
```

The key goes through the environment, never into `terraform.tfvars`:

```bash
cd flexi-day-be/terraform && TF_VAR_apple_private_key="$(cat ~/Downloads/AuthKey_<KEYID>.p8)" terraform plan
```

```bash
cd flexi-day-be/terraform && TF_VAR_apple_private_key="$(cat ~/Downloads/AuthKey_<KEYID>.p8)" terraform apply
```

The value still lands in `terraform.tfstate` in the clear, as every secret here does; what the
environment buys is keeping it out of a file you might paste from. The plan shows one new Secrets Manager secret and version
(`flexi-day-be-production-apple-private-key`, following the Microsoft secret's naming), the App
Runner service updated in place (the four plain env vars, the runtime secret and the changed
`TRUSTED_ORIGINS`; the plan prints the env maps as sensitive, so the names do not appear), and the
instance role's secrets policy with the new ARN. Nothing else from this change. `apple_client_id`
set with an empty key fails at plan time, by design. The apply rolls a new App Runner deployment;
give it three to five minutes.

Open question: whether a multi-line Secrets Manager value reaches the process with real newlines was
not checked. A parser that accepts both forms makes it moot, which is why the spec asks for one.

## 5. Phone config and the interactive build

### 5.1 `app.json` and the dev client

After sections 1.3, 2.3 and 3.5 the `app.json` diff is: the Google plugin with `iosUrlScheme`,
`ios.usesAppleSignIn: true` and the `expo-apple-authentication` plugin. `expo-auth-session` adds
nothing.

```bash
LANG=en_US.UTF-8 npm run prebuild
npm run ios:device
```

The device script passes `-allowProvisioningUpdates`, so Xcode replaces the development profile with
one that carries the new capability, as it did for Associated Domains
([`device-testing.md`](device-testing.md), "Invite links open the app"). `npm run ios` for the
simulator.

### 5.2 The first `eas build`, once

```bash
eas build --platform ios --profile production
```

Run it **without** `--non-interactive` and sign in to Apple when it asks. `eas build` syncs the App
ID's capabilities with the entitlements of the introspected config, finds the App Store profile
invalid after section 3.1, and offers to replace it. `--non-interactive` neither syncs capabilities
nor replaces the profile, so a CI-style build fails until this one has run. `eas credentials -p ios`
shows the profile and can remove it beforehand, which makes the build create a fresh one.

The sync runs both ways. `plugins/without-push-entitlement.js` strips `aps-environment`, so this
build also turns Push Notifications **off** on the App ID, unless it runs with
`EXPO_NO_CAPABILITY_SYNC=1`, which skips the sync. Expected until the push client keeps the
entitlement. [`releasing.md`](releasing.md) has the entitlement check for the built `.ipa`.

## 6. Local development

What the simulator and a phone on the LAN can exercise against a local backend, and what they
cannot.

- **Google.** The id-token path is a plain fetch to whatever `EXPO_PUBLIC_API_URL` or the Metro host
  points at; no redirect URI is involved, so a LAN backend needs nothing in Google Cloud. The
  `webClientId` baked into the app must equal the `GOOGLE_CLIENT_ID` of the backend it talks to,
  otherwise the audience check fails. The sign-in sheet is an `ASWebAuthenticationSession`, so it
  should work on the simulator, but no primary source says so. Try it first. Check the sheet on a
  real phone too, because `enableSceneSupport` is on and nothing read covers the SDK under a
  scene-based app.
- **Microsoft.** The redirect goes to the app (`flexiday://auth`), not to the backend, so the LAN
  backend needs nothing in Entra beyond section 2.1. Whether `ASWebAuthenticationSession` completes
  on the simulator is unconfirmed; Expo's own guide says to test the scheme on a simulator, and this
  dev client already runs there. This is where the release gate in 2.4 runs.
- **Apple.** The phone's id token verifies against Apple's JWKS with `aud` equal to the bundle id,
  so a local backend with the section 4.1 block signs the phone in. The web flow cannot run locally,
  because Apple refuses `localhost` return URLs. On the simulator Expo promises only "limited
  testing" and `getCredentialStateAsync` always throws there; whether `signInAsync` returns a
  verifiable identity token on the simulator needs a try, and a real phone is the fallback.
- **Seeded users.** `npm run dev:scenario` at the workspace root seeds `@dev.local` accounts; a
  social sign-in with a real provider account creates a fresh, unverified user instead, and
  `npm run dev:reset` does not remove it. Delete those rows by hand or through the account-deletion
  flow.

## 7. Verification

After wiring, per provider:

1. The backend stops answering 404 for `{"provider":"apple"}` on `POST /api/auth/sign-in/social`
   (Google and Microsoft already answer).
2. On the phone, sign in with each provider. A new account lands in the app signed in, with no group
   and a Flexi Day confirmation email in the mailbox. That email is expected: social sign-in never
   confers a verified address, and the user confirms it like any other sign-up.
3. In the database, the `account` row carries `provider_id` of `google`, `microsoft` or `apple`,
   and the `session` row is a native one, stamped with the device id, platform and app version and
   the ten-year expiry.
4. An address that already has a Flexi Day account gets a 401 `OAUTH_LINK_ERROR` and the "sign in
   with the method you used, then connect this one from Settings on the web" notice. Expected.
5. Apple, hidden email: the confirmation email reaches the relay address only after section 3.4.
   Apple, web: `https://www.flexi-day.com/sign-in/` › Continue with Apple › back on `/dashboard/`.
6. Microsoft: one work account and one personal account, against a dev backend, before release.

## 8. Rotation

- **Apple key.** The client secret rotates itself every hour. The key rotates by hand, and the
  two-key limit per App ID is what allows zero downtime: create the second key (3.3), apply with the
  new `apple_key_id` and `TF_VAR_apple_private_key`, confirm a web sign-in works, then revoke the
  first key in the portal. Revoke only once the switch is confirmed.
- **Microsoft.** Unchanged. The phone uses no secret. The Web secret keeps its 24-month expiry and
  the rotation in `flexi-day-be/terraform/terraform.tfvars.example`.
- **Google.** Nothing. The iOS client has no secret.

## 9. Troubleshooting

| Symptom                                                                                                  | Cause                                                                                      | Fix                                                                                  |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| App fails at the import with a missing native module                                                     | `google-signin` or `expo-apple-authentication` installed without a dev-client rebuild      | `npm run prebuild`, then `npm run ios` or `npm run ios:device`                       |
| "failed to determine clientID - GoogleService-Info.plist was not found and iosClientId was not provided" | `GoogleSignin.configure` called without `iosClientId`                                      | Pass the iOS client id from 1.1                                                      |
| Prebuild rejects `iosUrlScheme`                                                                          | It must start with `com.googleusercontent.apps.`                                           | Copy the "iOS URL scheme" from the client's page, not the client id                  |
| 401 `INVALID_TOKEN` on Google                                                                            | Token `aud` is not the backend's `GOOGLE_CLIENT_ID`                                        | `webClientId` must equal the `GOOGLE_CLIENT_ID` of the backend the app talks to      |
| 401 `INVALID_TOKEN` on Apple                                                                             | Token older than an hour, or `aud` is not `APPLE_APP_BUNDLE_IDENTIFIER`                    | Sign in again; check the env var                                                     |
| 401 `OAUTH_LINK_ERROR` ("account not linked")                                                            | The address already has an account; social sign-in never attaches itself                   | Expected. Sign in with the existing method, then connect from Settings on the web    |
| `USER_EMAIL_NOT_FOUND` on Microsoft                                                                      | Token carries no `email` claim: account has no address, or the optional claim is gone      | Check Token configuration on the registration                                        |
| `AADSTS7000218` (missing `client_secret`)                                                                | `flexiday://auth` landed on the Web platform instead of Mobile and desktop                 | Move it (2.1)                                                                        |
| `AADSTS700025`                                                                                           | The phone sent a secret to a public-client redirect                                        | The phone never holds a secret; remove it                                            |
| `AADSTS50011` (redirect URI mismatch)                                                                    | The URI in the request differs from the registered one                                     | Compare character for character with `flexiday://auth`                               |
| `POST /api/auth/sign-in/social` 404 for `apple`                                                          | Provider not registered: `APPLE_CLIENT_ID` or the key missing                              | Fill the whole block (4.1); restart or redeploy                                      |
| Apple web callback refused by the origin check                                                           | `https://appleid.apple.com` missing from `TRUSTED_ORIGINS`                                 | Add it (section 4)                                                                   |
| Connect Apple from Settings fails with `EMAIL_DOES_NOT_MATCH` or `LINKING_DIFFERENT_EMAILS_NOT_ALLOWED`  | The user hid their email, so Apple reports a relay address that never equals the account's | Known consequence of the no-different-emails rule; the spec decides what the UI says |
| No mail reaches a `privaterelay.appleid.com` address                                                     | Email sources not registered, or the source fails Apple's check                            | Section 3.4; DKIM on `flexi-day.com` is what passes, SPF cannot                      |
| `eas build --non-interactive` fails on the profile after 3.1                                             | A capability change invalidated the App Store profile                                      | Run one interactive build (5.2)                                                      |
| Push Notifications turned off on the App ID after a build                                                | Capability sync mirrors the entitlements, and the push entitlement is stripped             | Expected until the push client lands; `EXPO_NO_CAPABILITY_SYNC=1` skips the sync     |
| Microsoft sign-in blocked in a customer tenant                                                           | Conditional access requiring an approved app or app protection policy                      | Known limitation (2.5); Safari is blocked there too, Edge on the web works           |

## Sources

- Google: `docs/research/google-id-token.md` on branch `research/google-id-token` of this repo.
- Microsoft: `docs/research/entra-public-client.md` on branch `research/entra-public-client` of
  `flexi-day-be`.
- Apple: `docs/research/apple-sign-in.md` on branch `research/apple-sign-in` of `flexi-day-be`.

Each note lists the primary sources it rests on and the questions it left open.
