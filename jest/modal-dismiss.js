// iOS calls a Modal's onDismiss once it has finished hiding; React Native's own mock never does.
jest.mock("react-native/Libraries/Modal/Modal", () => {
  const Modal = jest.requireActual("@react-native/jest-preset/jest/mocks/Modal").default;

  class DismissingModal extends Modal {
    componentDidUpdate(previous) {
      if (previous.visible !== false && this.props.visible === false) this.props.onDismiss?.();
    }
  }

  return { __esModule: true, default: DismissingModal };
});
