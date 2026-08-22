/**
 * Freighter wallet connection hook.
 *
 * Exposes the exact shape required by the wallet components:
 *   `{ address, status, connect, disconnect }`
 * plus `error` so wallet problems are surfaced distinctly instead of being
 * silently swallowed. `error.code` distinguishes:
 *
 *   - `not-installed` – the Freighter browser extension is missing
 *   - `declined`      – the user rejected the connection request
 *   - `wrong-network` – wallet is connected, but on a different Stellar network
 *   - `unknown`       – anything else (raw SDK error text is never shown)
 *
 * Network matching uses `VITE_STELLAR_NETWORK` via `getNetworkPassphrase()`
 * from `src/services/stellar.ts`.
 */

import { useCallback, useEffect, useState } from "react";
import {
  getAddress,
  getNetwork,
  isConnected,
  requestAccess,
} from "@stellar/freighter-api";
import { NETWORK, type NetworkName } from "@/config/contracts";
import { getNetworkPassphrase } from "@/services/stellar";

export type WalletStatus = "disconnected" | "connecting" | "connected";

export type WalletErrorCode =
  | "not-installed"
  | "declined"
  | "wrong-network"
  | "unknown";

export interface WalletError {
  code: WalletErrorCode;
  message: string;
}

export interface UseWalletReturn {
  address: string | null;
  status: WalletStatus;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Non-null when the last connect attempt failed (or the network is wrong). */
  error: WalletError | null;
}

/**
 * Error code Freighter returns when the user rejects a request.
 * Verified against the installed freighter-api v5.0.0 source
 * (`FreighterApiDeclinedError = { code: -4, ... }`).
 */
const FREIGHTER_DECLINED_ERROR_CODE = -4;

/** Display names for the networks StellarFlow supports. */
const NETWORK_LABELS: Record<NetworkName, string> = {
  public: "Mainnet",
  testnet: "Testnet",
  futurenet: "Futurenet",
  standalone: "Standalone",
};

/** Human-readable name of the network this build targets (e.g. "Testnet"). */
export const EXPECTED_NETWORK_LABEL = NETWORK_LABELS[NETWORK];

/** Maps Freighter's `getNetwork()` network string to a friendly label. */
function freighterNetworkLabel(walletNetwork: string): string {
  const known: Record<string, string> = {
    PUBLIC: "Mainnet",
    TESTNET: "Testnet",
    FUTURENET: "Futurenet",
    STANDALONE: "Standalone",
  };
  return known[walletNetwork] ?? (walletNetwork || "a different network");
}

function wrongNetworkMessage(walletNetwork: string): string {
  return `Freighter is on ${freighterNetworkLabel(walletNetwork)}, but StellarFlow runs on ${EXPECTED_NETWORK_LABEL}. Open Freighter → Settings → Network, switch to ${EXPECTED_NETWORK_LABEL}, then reconnect.`;
}

const MESSAGES: Record<Exclude<WalletErrorCode, "wrong-network">, string> = {
  "not-installed":
    "Freighter isn't installed. Install the Freighter browser extension and refresh this page to connect your wallet.",
  declined:
    "Connection request declined. Approve the request in the Freighter popup to connect your wallet.",
  unknown: "Couldn't connect your wallet. Please try again.",
};



export function useWallet(): UseWalletReturn {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [error, setError] = useState<WalletError | null>(null);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);

    try {
      const access = await requestAccess();
      if (access.error) {
        setAddress(null);
        setStatus("disconnected");
        setError(
          access.error.code === FREIGHTER_DECLINED_ERROR_CODE
            ? { code: "declined", message: MESSAGES.declined }
            : { code: "not-installed", message: MESSAGES["not-installed"] },
        );
        return;
      }

      const account = await getAddress();
      if (account.error || !account.address) {
        setAddress(null);
        setStatus("disconnected");
        setError({ code: "unknown", message: MESSAGES.unknown });
        return;
      }

      const network = await getNetwork();
      if (network.error) {
        setAddress(null);
        setStatus("disconnected");
        setError({ code: "unknown", message: MESSAGES.unknown });
        return;
      }

      if (network.networkPassphrase !== getNetworkPassphrase()) {
        // Connected, but the wallet is on the wrong network.
        setAddress(account.address);
        setStatus("connected");
        setError({
          code: "wrong-network",
          message: wrongNetworkMessage(network.network),
        });
        return;
      }

      setAddress(account.address);
      setStatus("connected");
      setError(null);
    } catch {
      setAddress(null);
      setStatus("disconnected");
      setError({ code: "not-installed", message: MESSAGES["not-installed"] });
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setStatus("disconnected");
    setError(null);
  }, []);

  // Best-effort restore: if the wallet is already authorized, pick up the
  // address + network silently (no popup). Failures are ignored — the user
  // can still connect explicitly.
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const connected = await isConnected();
        if (!active || !connected.isConnected || connected.error) return;

        const account = await getAddress();
        if (!active || account.error || !account.address) return;

        const network = await getNetwork();
        if (!active || network.error) return;

        setAddress(account.address);
        setStatus("connected");
        setError(
          network.networkPassphrase === getNetworkPassphrase()
            ? null
            : { code: "wrong-network", message: wrongNetworkMessage(network.network) },
        );
      } catch {
        // Ignore restore failures; the user can connect explicitly.
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return { address, status, connect, disconnect, error };
}
