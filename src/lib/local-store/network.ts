import { getNetworkStateAsync } from "expo-network";

/** Whether a pull is worth attempting; a network state the device cannot report counts as online. */
export async function deviceIsOnline(): Promise<boolean> {
  try {
    const state = await getNetworkStateAsync();
    return state.isInternetReachable ?? state.isConnected ?? true;
  } catch {
    return true;
  }
}
