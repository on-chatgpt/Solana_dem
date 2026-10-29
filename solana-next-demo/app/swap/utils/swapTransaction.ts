import axios from "axios";
import { Connection, VersionedTransaction, PublicKey } from "@solana/web3.js";

const RAYDIUM_DEVNET = "https://transaction-v1-devnet.raydium.io";
const RPC = "https://api.devnet.solana.com";

export async function raydiumSwap({ wallet, quoteData }: { wallet: any; quoteData: any }) {
  const connection = new Connection(RPC, "confirmed");

  /** 2️⃣ 请求 Swap 交易 */
  const { data: txResp } = await axios.post(`${RAYDIUM_DEVNET}/transaction/swap-base-in`, {
    txVersion: "V0",
    wallet: wallet.publicKey.toBase58(),
    computeUnitPriceMicroLamports: "100000",
    swapResponse: quoteData,
    wrapSol: true,
    unwrapSol: true,
  });

  const txBase64 = txResp.data[0].transaction;
  const txBuffer = Buffer.from(txBase64, "base64");
  const transaction = VersionedTransaction.deserialize(txBuffer);

  /** 3️⃣ 钱包签名 */
  const signedTx = await wallet.signTransaction(transaction);

  /** 4️⃣ 发送交易 */
  const txid = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
  });

  await connection.confirmTransaction(txid, "confirmed");

  return txid;
}
