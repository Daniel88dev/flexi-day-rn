// Public OAuth client identifiers, shipped in the binary and shared by every environment.
// The web client id is the backend's GOOGLE_CLIENT_ID: it becomes the id token's audience.
export const GOOGLE_WEB_CLIENT_ID =
  "456983325414-mlmjm7v0uflirmhd66v2fio7qn63mqu6.apps.googleusercontent.com";

export const GOOGLE_IOS_CLIENT_ID =
  "456983325414-tt5nktncl12ece3qjrtb043jlc4lia37.apps.googleusercontent.com";

// The Entra registration's application id, the backend's MICROSOFT_CLIENT_ID: it becomes the id
// token's audience. The redirect is registered there under Mobile and desktop applications.
export const MICROSOFT_CLIENT_ID = "ec789c03-b4b5-4ee8-9183-1290f03cde3a";

export const MICROSOFT_REDIRECT_URI = "flexiday://auth";
