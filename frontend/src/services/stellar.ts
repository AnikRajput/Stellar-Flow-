import { Networks, rpc } from "@stellar/stellar-sdk";
import { NETWORK, RPC_URL, type NetworkName } from "@/config/contracts";

/** Passphrase per supported network (matches the `NetworkName` union). */
const NETWORK_PASSPHRASES: Record<NetworkName, string> = {
  public: Networks.PUBLIC,
  testnet: Networks.TESTNET,
  futurenet: Networks.FUTURENET,
  standalone: Networks.STANDALONE,
};

/**
 * Shared Soroban RPC server bound to `VITE_RPC_URL`.
 * `allowHttp` is enabled so a local/standalone node (http://localhost:...) works.
 */
export function getServer(): rpc.Server {
  return new rpc.Server(RPC_URL, {
    allowHttp: RPC_URL.startsWith("http://"),
  });
}

/**
 * Network passphrase for `VITE_STELLAR_NETWORK`
 * (e.g. `Networks.TESTNET`). The value is validated in `src/config/contracts.ts`,
 * so this lookup is total.
 */
export function getNetworkPassphrase(): string {
  return NETWORK_PASSPHRASES[NETWORK];
}
