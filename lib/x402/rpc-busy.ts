/** The Solana RPC refused us for going too fast (429) or blocked this server (403), even after waiting. */
export class RpcBusyError extends Error {
  constructor(readonly status: number) {
    super("Solana's network is busy right now. Wait about 10 seconds and try again.");
    this.name = "RpcBusyError";
  }
}
