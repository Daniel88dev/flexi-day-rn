// The real module reaches for its native TurboModule on import, which Jest lacks.
module.exports = {
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(async () => ({ type: "cancelled", data: null })),
    signOut: jest.fn(async () => null),
  },
};
