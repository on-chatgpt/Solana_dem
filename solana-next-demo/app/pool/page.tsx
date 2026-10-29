"use client";

import { useMemo, useState } from "react";
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  CREATE_CPMM_POOL_PROGRAM,
  Raydium,
  getCpmmPdaPoolId,
  toApiV3Token,
  TxVersion,
} from "@raydium-io/raydium-sdk-v2";

type PoolType = "standard_cpmm" | "legacy_amm_v4";

function getRaydiumCluster(): "devnet" | "mainnet" {
  // 强制开发环境：确保所有操作都在 devnet
  const c = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "").toLowerCase();
  // 如果明确设置了 mainnet，才返回 mainnet；否则强制 devnet
  if (c === "mainnet-beta" || c === "mainnet") {
    console.warn("⚠️ 检测到 mainnet 配置，但建议使用 devnet 进行开发");
    return "mainnet";
  }
  // 默认强制 devnet（开发环境）
  return "devnet";
}

function toRawBn(amount: string, decimals: number): BN {
  const a = (amount || "").trim();
  if (!a) return new BN(0);
  if (!/^\d+(\.\d+)?$/.test(a)) throw new Error(`invalid amount: ${amount}`);
  const [i, f = ""] = a.split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  const raw = (i + frac).replace(/^0+/, "") || "0";
  return new BN(raw);
}

async function getMintMeta(connection: any, mintStr: string) {
  const mint = new PublicKey(mintStr);
  const accInfo = await connection.getAccountInfo(mint);
  if (!accInfo) throw new Error(`mint not found: ${mintStr}`);
  const programId = accInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;
  const mintInfo = await getMint(connection, mint, "confirmed", programId);
  return {
    mint,
    decimals: mintInfo.decimals,
    programId,
  };
}

function getSignAllTransactions(wallet: any) {
  if (wallet.signAllTransactions)
    return wallet.signAllTransactions.bind(wallet);
  if (wallet.signTransaction) {
    return async (txs: any[]) =>
      Promise.all(txs.map((t) => wallet.signTransaction(t)));
  }
  throw new Error("wallet does not support signing transactions");
}

export default function PoolPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, connected } = wallet;

  const [poolType, setPoolType] = useState<PoolType>("standard_cpmm");
  const [mintA, setMintA] = useState<string>(
    "So11111111111111111111111111111111111111112"
  );
  const [mintB, setMintB] = useState<string>(
    process.env.NEXT_PUBLIC_HHF_TOKEN_MINT || ""
  );
  const [amountA, setAmountA] = useState<string>("0.1");
  const [amountB, setAmountB] = useState<string>("0.1");

  const [lotSize, setLotSize] = useState<string>("1");
  const [tickSize, setTickSize] = useState<string>("0.01");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<any>(null);

  const disabled = useMemo(
    () => !connected || !publicKey || loading,
    [connected, publicKey, loading]
  );

  const handleCreate = async () => {
    if (!publicKey) return;
    setLoading(true);
    setErr("");
    setResult(null);
    try {
      const signAllTransactions = getSignAllTransactions(wallet);
      const raydium = await Raydium.load({
        connection,
        owner: publicKey,
        signAllTransactions,
        cluster: getRaydiumCluster(),
        disableFeatureCheck: true,
        blockhashCommitment: "confirmed",
      });

      const metaA = await getMintMeta(connection, mintA);
      const metaB = await getMintMeta(connection, mintB);
      const bnA = toRawBn(amountA, metaA.decimals);
      const bnB = toRawBn(amountB, metaB.decimals);
      if (bnA.isZero() || bnB.isZero()) throw new Error("amount must be > 0");

      if (poolType === "standard_cpmm") {
        const configs = await raydium.api.getCpmmConfigs();
        const feeConfig =
          configs.find((c: any) => c.tradeFeeRate === 2500) || configs[0];
        if (!feeConfig) throw new Error("no cpmm configs");

        // 预检查：同一 feeConfig + mintA/mintB 的 CPMM 池子地址是 PDA，重复创建会失败
        const [m1, m2] =
          metaA.mint.toBuffer().compare(metaB.mint.toBuffer()) <= 0
            ? [metaA.mint, metaB.mint]
            : [metaB.mint, metaA.mint];
        const expectedPoolId = getCpmmPdaPoolId(
          CREATE_CPMM_POOL_PROGRAM,
          new PublicKey(feeConfig.id),
          m1,
          m2
        ).publicKey;
        const exists = await connection.getAccountInfo(expectedPoolId);
        if (exists) {
          throw new Error(
            `这个 Standard AMM（CPMM）池子已存在（同 fee tier + 同 token pair）：poolId=${expectedPoolId.toBase58()}`
          );
        }

        const mintAApi = toApiV3Token({
          address: metaA.mint.toBase58(),
          decimals: metaA.decimals,
          programId: metaA.programId.toBase58(),
        } as any);
        const mintBApi = toApiV3Token({
          address: metaB.mint.toBase58(),
          decimals: metaB.decimals,
          programId: metaB.programId.toBase58(),
        } as any);

        const { execute, extInfo } = await raydium.cpmm.createPool({
          programId: CREATE_CPMM_POOL_PROGRAM,
          poolFeeAccount: new PublicKey(feeConfig.id),
          mintA: mintAApi,
          mintB: mintBApi,
          mintAAmount: bnA,
          mintBAmount: bnB,
          startTime: new BN(0),
          feeConfig,
          associatedOnly: false,
          checkCreateATAOwner: true,
          txVersion: TxVersion.V0,
          ownerInfo: { useSOLBalance: true },
        } as any);

        const res = await execute({ sendAndConfirm: true });
        const poolId = extInfo?.address?.poolId;
        try {
          if (poolId)
            localStorage.setItem("raydium_last_poolId", String(poolId));
        } catch {
          // ignore
        }
        if (poolId) {
          const info = await connection.getAccountInfo(
            new PublicKey(String(poolId))
          );
          if (!info)
            throw new Error(
              `创建交易返回了 poolId，但链上未找到该 pool account：${poolId}`
            );
        }
        setResult({
          type: "CPMM(Standard AMM)",
          tx: res,
          address: extInfo?.address,
        });
        return;
      }

      const { execute, extInfo } =
        await raydium.liquidity.createMarketAndPoolV4({
          baseMintInfo: { mint: metaA.mint, decimals: metaA.decimals },
          quoteMintInfo: { mint: metaB.mint, decimals: metaB.decimals },
          baseAmount: bnA,
          quoteAmount: bnB,
          startTime: new BN(0),
          ownerInfo: { useSOLBalance: true },
          lotSize: Number(lotSize) || 1,
          tickSize: Number(tickSize) || 0.01,
          associatedOnly: false,
          checkCreateATAOwner: true,
          txVersion: TxVersion.V0,
        } as any);

      const res = await execute({ sendAndConfirm: true, sequentially: true });
      const poolId = extInfo?.address?.ammId;
      try {
        if (poolId) localStorage.setItem("raydium_last_poolId", String(poolId));
      } catch {
        // ignore
      }
      setResult({ type: "Legacy AMM v4", tx: res, address: extInfo?.address });
    } catch (e: any) {
      setErr(e?.message || "unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Create Pool（简化版）</h1>
          <div className="text-xs opacity-70">
            参考：
            <a
              className="underline ml-1"
              href="https://raydium.io/portfolio/"
              target="_blank"
              rel="noreferrer"
            >
              raydium.io/portfolio
            </a>
          </div>
        </div>
        <div className="text-xs opacity-70 break-all text-right space-y-1">
          <div>
            {connected && publicKey
              ? `owner: ${publicKey.toBase58()}`
              : "未连接钱包"}
          </div>
          <div className="font-medium text-orange-600">
            网络: {getRaydiumCluster()}（开发环境）
          </div>
        </div>
      </div>

      <div className="rounded border p-3 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <button
            className={`px-3 py-2 rounded border ${
              poolType === "standard_cpmm" ? "bg-black text-white" : "bg-white"
            }`}
            onClick={() => setPoolType("standard_cpmm")}
            type="button"
          >
            Standard AMM（CPMM）
          </button>
          <button
            className={`px-3 py-2 rounded border ${
              poolType === "legacy_amm_v4" ? "bg-black text-white" : "bg-white"
            }`}
            onClick={() => setPoolType("legacy_amm_v4")}
            type="button"
          >
            Legacy AMM v4
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-xs opacity-70">Mint A</div>
            <input
              className="w-full px-2 py-1 rounded border text-sm"
              value={mintA}
              onChange={(e) => setMintA(e.target.value.trim())}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs opacity-70">Mint B</div>
            <input
              className="w-full px-2 py-1 rounded border text-sm"
              value={mintB}
              onChange={(e) => setMintB(e.target.value.trim())}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs opacity-70">Amount A</div>
            <input
              className="w-full px-2 py-1 rounded border text-sm"
              value={amountA}
              onChange={(e) => setAmountA(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs opacity-70">Amount B</div>
            <input
              className="w-full px-2 py-1 rounded border text-sm"
              value={amountB}
              onChange={(e) => setAmountB(e.target.value)}
            />
          </div>
        </div>

        {poolType === "legacy_amm_v4" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="text-xs opacity-70">lotSize（默认 1）</div>
              <input
                className="w-full px-2 py-1 rounded border text-sm"
                value={lotSize}
                onChange={(e) => setLotSize(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs opacity-70">tickSize（默认 0.01）</div>
              <input
                className="w-full px-2 py-1 rounded border text-sm"
                value={tickSize}
                onChange={(e) => setTickSize(e.target.value)}
              />
            </div>
          </div>
        )}

        <button
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          onClick={handleCreate}
          disabled={disabled}
        >
          {loading ? "创建中..." : "Create Pool"}
        </button>

        {err && <div className="text-xs text-red-600 break-all">{err}</div>}

        {result && (
          <div className="rounded border p-3 text-sm space-y-2">
            <div className="font-medium">{result.type}</div>
            <div className="text-xs opacity-70 break-all">
              address: {result.address ? JSON.stringify(result.address) : "n/a"}
            </div>
            <div className="text-xs opacity-70 break-all">
              tx: {JSON.stringify(result.tx)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
