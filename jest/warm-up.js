const { WARM_UP_TIMEOUT, warmUpReactNative } = require("../src/test-support/warm-up");

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);
