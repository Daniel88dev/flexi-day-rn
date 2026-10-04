# Google sign-in on the iPhone through an id token

Researched 2026-10-04 against better-auth 1.7.6 and `@better-auth/core` 1.7.6 in `flexi-day-be`
(commit `810fb55`), `@better-auth/expo` 1.7.6 in this repo (commit `3d8cba8`), and
`@react-native-google-signin/google-signin` 16.1.5, the current `latest` on npm. Numbers in
brackets point at the Sources list at the end.

## Answer

Yes. The free `@react-native-google-signin/google-signin` package can mint a Google id token whose
`aud` is the web client id the backend already holds as `GOOGLE_CLIENT_ID`, and
`authClient.signIn.social({ provider: "google", idToken: { token } })` signs the user in with it.
The backend needs no change: no new env var, no Terraform, no second client id in
`socialProviders`. Three conditions apply. `GoogleSignin.configure` must get the existing web
client id as `webClientId`, because that becomes the token's audience [4][5]. A new OAuth client of
type iOS for `com.flexiday.app` must exist in the same Google Cloud project, because the native
module refuses to configure without one [3]. And `app.json` needs the package's config plugin with
the reversed iOS client id as `iosUrlScheme`, followed by a prebuild and a dev-client rebuild [7][8].

The nonce is the one gap. The free package exposes no nonce [2][3], so the request goes without
one. better-auth accepts that, because it compares a nonce only when the client sends one [11][12].
A nonce would buy little on this path anyway, since better-auth never issues one and only checks
the token against whatever string the same request carries. The session that comes back is a
native, device-bound one with the ten-year expiry. The two-factor hook does not run.
`mapProfileToUser` does run, so the user stays `emailVerified: false`. An address that already has
a Flexi Day account gets `account not linked`, exactly as on the web.

## 1. Making `aud` the web client id

`GoogleSignin.configure({ webClientId, iosClientId })` is the whole recipe.

- The native module builds `GIDConfiguration` with `initWithClientID:clientId
serverClientID:options[@"webClientId"]` [3]. Google documents `serverClientID` as "the client ID
  of the home server. This will be returned as the audience property of the OpenID Connect ID
  token" [4]. Google's iOS setup guide calls this second id the server client id and has you create
  it as a Web application client [5]. The web client the backend already uses is that client.
- better-auth's Google provider verifies `audience: options.clientId` [10], and `jwtVerify` in
  `verifyProviderIdToken` enforces it [11]. Google's backend guide states the same requirement
  for any verifier, `aud` equal to one of your client ids [6].
- The library documents `webClientId` as the "client ID of type WEB for your server. Required to
  get the `idToken` on the user object" [1]. Its `types.ts` comment says the token is only non-null
  with `offlineAccess: true` [2], but the iOS code reads `user.idToken.tokenString` with no
  dependency on that flag [3]. Leave `offlineAccess` off. The app needs no server auth code.
- An iOS client id is still required. `configure` rejects with "failed to determine clientID -
  GoogleService-Info.plist was not found and iosClientId was not provided" when it has neither [3].
  Google's guide also requires an OAuth client of application type iOS for the app itself [5].
- No `GoogleService-Info.plist`. The plugin has a no-Firebase mode that takes one option,
  `iosUrlScheme`, validates that it starts with `com.googleusercontent.apps.`, and appends it to the
  Info.plist URL schemes [7]. The value is the reversed iOS client id, which the Cloud console shows
  as "iOS URL scheme" [5][9]. Pass `iosClientId` in `configure` instead of the plist [1][3].
- The plugin adds no `openURL` handler, and the library's iOS guide calls that step optional,
  needed only when several SDKs compete for `openURL` [8].
- New architecture. Version 16.1.5 ships a `codegenConfig` and a TurboModule implementation behind
  `RCT_NEW_ARCH_ENABLED` [3]. Its peer range is `expo >=52.0.40` and `react-native *` (npm
  metadata). The docs' compatibility table, Expo 52.0.40 to 57 and React Native 0.76 to 0.87,
  covers this app's Expo 57 and React Native 0.86.3. Note that the table is written for the paid
  Universal Sign In build. The docs give no separate table for the free package [13].
- The pod depends on `GoogleSignIn ~> 9.0` [3].

## 2. Nonce

- The free package does not expose one. `SignInParams` has one field, `loginHint` [2], and the iOS
  `signIn` calls `signInWithPresentingViewController:hint:additionalScopes:completion:`, the
  overload without a nonce [3].
- The native SDK has one. GoogleSignIn-iOS added "a custom `nonce` via GSI to AppAuth" in 9.0.0
  [15], and `GIDSignIn.h` declares `signInWithPresentingViewController:hint:additionalScopes:nonce:completion:`
  [16]. Two wrappers pass it through. The paid Universal Sign In build accepts `nonce` on Apple,
  Android and web [14], and `react-native-nitro-google-signin` takes `nonce` in `configure` and
  hands it to the SDK on iOS [18].
- better-auth's checks. The request schema marks `idToken.nonce` optional [10]. The `/sign-in/social`
  branch passes it to `verifyProviderIdToken` [10], and the only nonce check there is:

  ```js
  if (nonce && !(await nonceMatches(payload.nonce, nonce, config.nonceComparison))) return false;
  ```

  With no nonce in the body the check is skipped [11]. The Google provider sets no
  `nonceComparison`, so a nonce that is sent must equal the claim exactly [10][11].

- What the token itself gets checked for: signature against
  `https://www.googleapis.com/oauth2/v3/certs`, issuer `accounts.google.com` or
  `https://accounts.google.com`, `audience: options.clientId`, `maxTokenAge: "1h"` and expiry, plus
  `hd` only when configured [10][11].
- Nothing server-side ties a nonce to a session. better-auth neither issues nor stores one on this
  path, so a nonce cannot stop replay of a captured request. It only proves the token was minted
  for a value the same client chose. I would ship without it and not pay for Universal Sign In or
  add `react-native-nitro-modules` for it.

## 3. The wire path and the session it mints

- The expo client's `init` treats any body with `idToken` specially. It sends `cookie` only when the
  path ends in `/link-social`, so a `/sign-in/social` request carries no cookie. It also sends no
  `expo-origin`, only `x-skip-oauth-proxy: true` [19]. The redirect branch in `onSuccess` skips any
  request whose body includes `idToken`, so the browser and `/expo-authorization-proxy` never come
  into play [19].
- `authClient`'s `onRequest` runs `attachClientHeaders` on every request, which adds
  `x-client-device-id`, `x-client-session-id`, `x-client-platform` and `x-client-app-version` [20].
  The backend calls a request native when it carries a well-formed device id (`readNativeClient`,
  `flexi-day-be/src/utils/clientHeaders.ts:53`).
- Origin and CSRF. better-auth validates the origin only when the request has a `cookie` header
  (`origin-check.mjs:101-108`), and `/sign-in/social` has no `formCsrfMiddleware`; only email
  sign-in does (`sign-in.mjs:243`). A cookie-less id-token request passes without an origin.
- The device-binding `hooks.before` in `auth.ts:241-274` does not act on this request. It returns
  at `if (!token) return;` because there is no session cookie. That is correct for a sign-in. The
  binding comes from three other places, all path-agnostic:
  - `databaseHooks.session.create.before` (`auth.ts:217-230`) stamps `deviceId`, `platform`,
    `appVersion` and the ten-year `expiresAt` through `nativeSessionStamp`
    (`nativeSession.ts:37-45`). The id-token branch creates the session through
    `internalAdapter.createSession` (`link-account.mjs:322`), so the hook fires.
  - `hooks.after` (`auth.ts:285-290`) re-issues the cookie without `Max-Age` whenever
    `ctx.context.newSession` is set and the request is native. The branch ends in
    `setSessionCookie(c, data.data)` (`sign-in.mjs:212`), and that calls
    `ctx.context.setNewSession(session)` (`cookies/index.mjs:179`).
  - `nativeSessionEvictionPlugin` (`auth.ts:49-71`, matcher `() => true`) deletes the device's
    other sessions.
- Two-factor is skipped. The plugin's after hook matches only `/sign-in/email`,
  `/sign-in/username` and `/sign-in/phone-number` (`two-factor/index.mjs:245-247`). The comment at
  `auth.ts:310-311` says so, and it matches the web's Google sign-in today.
- `mapProfileToUser` runs. The branch calls `provider.getUserInfo({ idToken: token, ... })`
  [10]. Google's `getUserInfo` decodes the token, calls `options.mapProfileToUser`, and spreads the
  result over `emailVerified: user.email_verified` (`google.mjs:116-135`). `NEVER_TRUST_PROVIDER_EMAIL`
  returns `{ emailVerified: false }` (`socialProviders.ts:31,47`), and the branch then passes
  `emailVerified: userInfo.user.emailVerified || false` (`sign-in.mjs:188`).
- Results the app has to handle:
  - New user. better-auth creates the user unverified, sends the confirmation email
    (`link-account.mjs:313`) and returns a session.
  - Existing user with this Google account linked. Signs straight in.
  - Existing address without a Google link. `disableImplicitLinking: true`
    (`socialProviders.ts:91-97`) makes `handleOAuthUserInfo` return `"account not linked"`
    (`link-account.mjs:139-145`), which the route turns into a 401 with code `OAUTH_LINK_ERROR`
    [10]. The web shows "sign in with the method you used, then connect this one from Settings"
    (`socialProviders.ts:25-29`), and the phone needs its own copy of that message.
  - Bad or foreign token. 401 `INVALID_TOKEN` [10].

## 4. Simulator and dev-client rebuild

- The package has native code, so it cannot run in Expo Go and needs a development build [8][17].
  This repo already runs a dev client, so the steps follow `CLAUDE.md`, "Continuous native
  generation":
  1. `npx expo install @react-native-google-signin/google-signin`.
  2. Add `["@react-native-google-signin/google-signin", { "iosUrlScheme": "com.googleusercontent.apps.<id>" }]`
     to `plugins` in `app.json`.
  3. `LANG=en_US.UTF-8 npm run prebuild`, then `npm run ios` for the simulator or
     `npm run ios:device` for the phone. A URL scheme is not a capability, so it should not
     invalidate provisioning profiles the way `associatedDomains` did (`docs/device-testing.md`,
     "Invite links open the app").
- The two client ids are public values that end up in the binary, the iOS one visibly in
  Info.plist. They can live in `app.json` and source, or as `EXPO_PUBLIC_*` variables. If they go
  in env, they also go into `.env.example`, the README and the production profile in `eas.json`,
  per `CLAUDE.md`.
- Simulator. I found no primary source that says either way. GoogleSignIn-iOS runs the flow
  through AppAuth in an `ASWebAuthenticationSession` [16]. See open questions.
- GoogleSignIn keeps its own session in the Keychain and purges it on a fresh install [16]. That
  only touches its own item. `signedOutWipe()` should also call `GoogleSignin.signOut()` so the next
  sign-in offers the account picker again [1].

## 5. Google Cloud console runbook

1. Open the Google Cloud project that owns the web client whose id is `GOOGLE_CLIENT_ID` in
   production. The iOS client has to sit in that project. Google groups an app's web, Android and
   iOS clients in one project, and branding is set per project [9][21].
2. Google Auth Platform, Clients page, Create client, application type iOS [9].
3. Bundle ID `com.flexiday.app`. Team ID `S6FC47MMXJ`, optional unless App Check is turned on.
   App Store ID is optional and only exists once the app is published [9].
4. Leave "Protect your OAuth client from abuse with Firebase App Check" off for now. It needs the
   Team ID and a non-wildcard bundle id [9], plus Firebase App Check work in the app, which is a
   separate decision (see item 6).
5. Create. Copy the client id and the "iOS URL scheme" shown on the client's page [5][9].
6. Branding. Nothing new. The consent screen shows the project's branding, which the web client
   already uses [21]. The app name and logo only appear once the app is verified [21], same as
   today on the web.
7. The existing web client does not change. Its id stays the audience, and native clients use no
   redirect URIs [9]. The backend's `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and Terraform stay
   as they are. Google notes that client changes can take five minutes to a few hours to apply [9].

better-auth's own docs suggest giving `clientId` an array of web, iOS and Android ids [22]. That is
the alternative this design avoids. With `webClientId` set on the phone, the token's `aud` is the
web id, and the iOS id shows up only in `azp`, which better-auth does not check [10][11].

## 6. Rate limiting and abuse on the id-token path

What already covers it:

- `credentialsLimiter` is mounted on the prefix `/api/auth/sign-in` (`limiter.ts:146-158`,
  `server.ts:60`), so `/api/auth/sign-in/social` falls under it. It allows 20 failures per IP per
  15 minutes and skips successes (`limiter.ts:75-81`). The refusals listed in item 3 are all 401s,
  so they count.
- better-auth's built-in rule allows 3 requests per 10 s on any path starting with `/sign-in`
  (`rate-limiter/index.mjs:302-309`). The store is in memory, so each App Runner instance counts
  on its own.
- Sentry does not collect request bodies (`instrument.ts:26-34`), so tokens do not land there.

What the existing limiter does not cover:

- An outbound fetch per verification. `getGooglePublicKeys` fetches Google's certs on every call
  and caches nothing (`google.mjs:139-150`). Google says to cache the keys and refresh them per
  `Cache-Control` [6]. Any request whose token header parses costs a round trip to googleapis,
  and an outage there becomes a sign-in outage. The per-IP limits bound it from one source. Many
  sources are not bounded. The fix belongs in the backend: set the provider's `verifyIdToken`
  option to a verifier with a cached remote JWKS. better-auth then calls only that function [11],
  so it must repeat the issuer, audience, age and nonce checks itself.
- Successful sign-ups. Each new Google account creates a user and sends a confirmation email
  (`link-account.mjs:313`), and none of it counts against `credentialsLimiter`. The web's
  `/callback/google` already allows the same thing. The id-token path makes it scriptable without
  a browser, because the iOS client id is public and anyone can run Google sign-in against it for
  accounts they control. The emails only go to addresses the caller controls, so this costs SES
  quota and database rows but cannot target anyone else. App Check on the iOS client is Google's
  answer to impersonation of the app [9].
- Replay. A captured token stays valid for up to an hour (`maxTokenAge: "1h"` and `exp`) [10], and
  a nonce would not help (item 2). The app must never log the token. Sending it only over HTTPS
  to the backend is what Google's guide prescribes [6].

## Open questions

1. Does Google sign-in complete on the iOS Simulator? No primary source says. The flow is an
   `ASWebAuthenticationSession`, so I expect it to work. Try it before building UI around it.
2. Scene lifecycle. `enableSceneSupport: true` is on, and iOS 27 only enforces it on a real phone
   (`docs/device-testing.md`). The module finds its presenter through `RCTPresentedViewController()`
   [3]. Nothing I read covers GoogleSignIn under a scene-based app, so check on the phone too.
3. Publishing status. I did not find a Google page saying whether the project's audience setting,
   testing or production, treats a new iOS client differently from the web one. Look at the
   project's Audience page once before the first TestFlight build.
4. If a nonce is ever added, does Google echo the raw string into the `nonce` claim on iOS?
   better-auth compares exactly [11]. The Universal Sign In docs show a hashed variant for
   Supabase only [14]. I found no Google statement for iOS.

## Sources

1. react-native-google-signin, Original Google sign in API:
   https://react-native-google-signin.github.io/docs/original
2. `src/types.ts`, react-native-google-signin master at 16.1.5:
   https://github.com/react-native-google-signin/google-signin/blob/master/src/types.ts
3. `ios/RNGoogleSignin.mm`, `package.json` and `RNGoogleSignin.podspec`, same repo:
   https://github.com/react-native-google-signin/google-signin/tree/master/ios
4. Google, `GIDConfiguration` reference:
   https://developers.google.com/identity/sign-in/ios/reference/Classes/GIDConfiguration
5. Google, Get started with Google Sign-In for iOS and macOS:
   https://developers.google.com/identity/sign-in/ios/start-integrating
6. Google, Authenticate with a backend server (iOS):
   https://developers.google.com/identity/sign-in/ios/backend-auth
7. Expo config plugin source, `plugin/src/withGoogleSignIn.ts`:
   https://github.com/react-native-google-signin/google-signin/blob/master/plugin/src/withGoogleSignIn.ts
8. react-native-google-signin, Expo setup and iOS setup:
   https://react-native-google-signin.github.io/docs/setting-up/expo,
   https://react-native-google-signin.github.io/docs/setting-up/ios
9. Google Cloud Help, Manage OAuth Clients: https://support.google.com/cloud/answer/15549257
10. better-auth source in `flexi-day-be/node_modules`: `better-auth/dist/api/routes/sign-in.mjs`
    lines 60-70 and 154-215, `@better-auth/core/dist/social-providers/google.mjs` lines 109-150
11. `@better-auth/core/dist/oauth2/verify-id-token.mjs` lines 8-13 and 38-60
12. better-auth `oauth2/link-account.mjs`, `cookies/index.mjs`, `plugins/two-factor/index.mjs`,
    `api/rate-limiter/index.mjs` and `api/middlewares/origin-check.mjs`, line numbers inline above
13. react-native-google-signin, Installation: https://react-native-google-signin.github.io/docs/install
14. react-native-google-signin, Security (nonce) and Universal sign in:
    https://react-native-google-signin.github.io/docs/security,
    https://react-native-google-signin.github.io/docs/one-tap
15. GoogleSignIn-iOS changelog, 9.0.0:
    https://github.com/google/GoogleSignIn-iOS/blob/main/CHANGELOG.md
16. GoogleSignIn-iOS `GIDSignIn.h`, `GIDSignIn.m` and README:
    https://github.com/google/GoogleSignIn-iOS
17. Expo, Using Google authentication: https://docs.expo.dev/guides/google-authentication/
18. react-native-nitro-google-signin, README and `ios/HybridNitroGoogleSignin.swift`:
    https://github.com/react-native-nitro-google-sign-in/google-signin
19. `flexi-day-rn/node_modules/@better-auth/expo/dist/client.js` lines 637-697
20. `flexi-day-rn/src/lib/session/auth-client.ts`, `src/lib/session/client-headers.ts`
21. Google Cloud Help, Manage OAuth App Branding: https://support.google.com/cloud/answer/15549049 ;
    Google, Cross-client identity:
    https://developers.google.com/identity/protocols/oauth2/cross-client-identity
22. better-auth docs, Google: https://www.better-auth.com/docs/authentication/google
23. `flexi-day-be/src/utils/auth.ts`, `socialProviders.ts`, `nativeSession.ts`, `clientHeaders.ts`,
    `src/middleware/limiter.ts`, `src/server.ts`, `src/instrument.ts`, cited by line above
