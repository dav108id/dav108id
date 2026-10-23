import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { env, USDC } from "./config.js";

export interface Quote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  [key: string]: unknown;
}

export async function getQuote(inputMint: string, outputMint: string, amountRaw: bigint, slippageBps: number): Promise<Quote> {
  const url = new URL(`${env.jupiterApi}/quote`);
  url.searchParams.set("inputMint", inputMint);
  url.searchParams.set("outputMint", outputMint);
  url.searchParams.set("amount", amountRaw.toString());
  url.searchParams.set("slippageBps", String(slippageBps));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jupiter quote ${res.status}: ${await res.text()}`);
  return (await res.json()) as Quote;
}

/** Preis von 1 Token in USDC, abgeleitet aus einer Jupiter-Quote. */
export async function getUsdcPrice(mint: string, decimals: number): Promise<number> {
  const q = await getQuote(mint, USDC.mint, 10n ** BigInt(decimals), 50);
  return Number(q.outAmount) / 10 ** USDC.decimals;
}

/** Führt die Quote als Swap aus und gibt die Transaktions-Signatur zurück. */
export async function executeSwap(conn: Connection, wallet: Keypair, quote: Quote): Promise<string> {
  const res = await fetch(`${env.jupiterApi}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });
  if (!res.ok) throw new Error(`Jupiter swap ${res.status}: ${await res.text()}`);
  const { swapTransaction } = (await res.json()) as { swapTransaction: string };

  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));
  tx.sign([wallet]);

  const latest = await conn.getLatestBlockhash("confirmed");
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
  const conf = await conn.confirmTransaction(
    { signature: sig, blockhash: tx.message.recentBlockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    "confirmed",
  );
  if (conf.value.err) throw new Error(`Transaktion fehlgeschlagen: ${JSON.stringify(conf.value.err)} (${sig})`);
  return sig;
}
