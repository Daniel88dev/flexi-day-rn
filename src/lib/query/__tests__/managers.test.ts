import { focusManager, onlineManager, QueryClient, QueryObserver } from "@tanstack/react-query";
import type { AppStateStatus } from "react-native";

import { connectQueryManagers, type NetworkSource } from "@/lib/query/managers";

type Listener<T> = (value: T) => void;

function createSource<T>() {
  const listeners = new Set<Listener<T>>();
  return {
    listen(listener: Listener<T>) {
      listeners.add(listener);
      return { remove: () => void listeners.delete(listener) };
    },
    send(value: T) {
      for (const listener of [...listeners]) listener(value);
    },
    listening: () => listeners.size > 0,
  };
}

const appStateSource = createSource<AppStateStatus>();
type NetworkState = Parameters<Parameters<NetworkSource["addNetworkStateListener"]>[0]>[0];

const networkSource = createSource<NetworkState>();

let firstRead: (state: NetworkState) => void;

const appState = {
  addEventListener: (_: "change", listener: Listener<AppStateStatus>) =>
    appStateSource.listen(listener),
};
const network: NetworkSource = {
  addNetworkStateListener: (listener) => networkSource.listen(listener),
  getNetworkStateAsync: () =>
    new Promise<NetworkState>((resolve) => {
      firstRead = resolve;
    }),
};

let disconnect: () => void;

beforeEach(() => {
  disconnect = connectQueryManagers({ appState, network });
});

afterEach(() => disconnect());

describe("connectQueryManagers", () => {
  it("returns focus to the queries when the app comes back to the foreground", () => {
    appStateSource.send("background");
    expect(focusManager.isFocused()).toBe(false);

    appStateSource.send("active");
    expect(focusManager.isFocused()).toBe(true);
  });

  it("refetches a stale query when the app comes back to the foreground", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    client.mount();
    const queryFn = jest.fn().mockResolvedValue({ clockedIn: false });
    const observer = new QueryObserver(client, { queryKey: ["attendance-state", "own"], queryFn });
    const unsubscribe = observer.subscribe(() => undefined);
    await observer.refetch();
    expect(queryFn).toHaveBeenCalledTimes(1);

    appStateSource.send("background");
    appStateSource.send("active");
    await Promise.resolve();

    expect(queryFn).toHaveBeenCalledTimes(2);
    unsubscribe();
    client.unmount();
    client.clear();
  });

  it("goes offline when the internet stops being reachable, and back online when it returns", () => {
    networkSource.send({ isConnected: true, isInternetReachable: false });
    expect(onlineManager.isOnline()).toBe(false);

    networkSource.send({ isConnected: true, isInternetReachable: true });
    expect(onlineManager.isOnline()).toBe(true);
  });

  it("falls back on the connection when the device cannot tell whether the internet is reachable", () => {
    networkSource.send({ isConnected: false });
    expect(onlineManager.isOnline()).toBe(false);

    networkSource.send({});
    expect(onlineManager.isOnline()).toBe(true);
  });

  it("reads the network once on connect, so a phone that starts offline starts offline", async () => {
    firstRead({ isConnected: false, isInternetReachable: false });
    await Promise.resolve();

    expect(onlineManager.isOnline()).toBe(false);
  });

  it("keeps a change that arrived before the first read answered", async () => {
    networkSource.send({ isConnected: true, isInternetReachable: true });
    firstRead({ isConnected: false, isInternetReachable: false });
    await Promise.resolve();

    expect(onlineManager.isOnline()).toBe(true);
  });

  it("stops listening to the app state and the network once disconnected", () => {
    expect(appStateSource.listening()).toBe(true);
    expect(networkSource.listening()).toBe(true);

    disconnect();

    expect(appStateSource.listening()).toBe(false);
    expect(networkSource.listening()).toBe(false);
  });
});
