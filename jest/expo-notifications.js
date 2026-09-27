// The real module warns about Expo Go push on import and reaches for a native module Jest lacks.
// This keeps what the phone would hold in memory, so a test can read it back.
const scheduled = new Map();

module.exports = {
  __scheduled: scheduled,
  DEFAULT_ACTION_IDENTIFIER: "expo.modules.notifications.actions.DEFAULT",
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  SchedulableTriggerInputTypes: { DATE: "date" },
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({
    status: "undetermined",
    granted: false,
    canAskAgain: true,
    ios: { status: 0 },
  })),
  requestPermissionsAsync: jest.fn(async () => ({
    status: "granted",
    granted: true,
    canAskAgain: true,
    ios: { status: 2 },
  })),
  getAllScheduledNotificationsAsync: jest.fn(async () => [...scheduled.values()]),
  scheduleNotificationAsync: jest.fn(async (request) => {
    scheduled.set(request.identifier, { ...request });
    return request.identifier;
  }),
  cancelScheduledNotificationAsync: jest.fn(async (identifier) => {
    scheduled.delete(identifier);
  }),
  useLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
};
