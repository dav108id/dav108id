import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { config, SOL_MINT } from "./config.js";

export function loadKeypair(): Keypair | null {
  if (!config.privateKey) return null;
  try {
    return Keypair.fromSecretKey(bs58.decode(config.privateKey.trim()));
  } catch {
    throw new Error("PRIVATE_KEY konnte nicht gelesen werden (erwartet: Base58-Export aus Phantom)");
  }
}

/** Kontostand eines Tokens in ganzen Einheiten (z.B. 1.5 SOL). */
export async function tokenBalance(conn: Connection, owner: PublicKey, mint: string, decimals: number): Promise<number> {
  if (mint === SOL_MINT) return (await conn.getBalance(owner)) / 10 ** decimals;
  const res = await conn.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(mint) });
  return res.value.reduce((sum, acc) => sum + (acc.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
}
