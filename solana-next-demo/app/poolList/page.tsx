"use client";
import { useEffect, useState } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import { Connection, PublicKey } from "@solana/web3.js";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import axios from "axios";
import ClmmList from "./clmmList";
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const WALLET = new PublicKey("97xPWeBz5UJFaX1HkVDBU5mjnfznTHs8GmpzyS4AFfEr");
// 获取amm的池子
function formatAmount(raw: bigint, decimals: number, maxFracDigits = 6): string {
  if (decimals <= 0) return raw.toString();
  const s = raw.toString();
  const pad = decimals - s.length;
  const full = pad > 0 ? "0".repeat(pad) + s : s;
  const intPart = full.length > decimals ? full.slice(0, full.length - decimals) : "0";
  let fracPart = full.slice(full.length - decimals).replace(/0+$/, "");
  if (maxFracDigits >= 0 && fracPart.length > maxFracDigits) fracPart = fracPart.slice(0, maxFracDigits).replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

async function getMyLiquidityPositions() {
  try {
    const raydium = await Raydium.load({
      connection,
      owner: WALLET,
      cluster: "devnet",
      disableFeatureCheck: true,
      disableLoadToken: true,
      blockhashCommitment: "confirmed",
    });
    console.log(raydium, 789);
    // 获取钱包中的 token accounts
    await raydium.account.fetchWalletTokenAccounts();

    const nonZeroTokenAccounts = raydium.account.tokenAccounts.filter((t: any) => !t.amount?.isZero?.());

    // 获取所有非零的 LP mint 地址
    const lpMintCandidates = Array.from(new Set(nonZeroTokenAccounts.map((t: any) => t.mint?.toBase58?.()).filter(Boolean))) as string[];

    // 通过 API 查询 Standard LP pools
    let standardLpPositions: any[] = [];
    if (lpMintCandidates.length > 0) {
      const apiUrl = `https://api-v3-devnet.raydium.io/pools/info/lps`;
      const { data: response } = await axios.get(apiUrl, {
        params: {
          lps: lpMintCandidates.join(","),
        },
      });
      const poolData = (response.data || []).filter((item: any) => item !== null);

      standardLpPositions = poolData
        .map((pool: any) => {
          const lpMint = pool?.lpMint?.address;
          const decimals = pool?.lpMint?.decimals ?? pool?.lpMintDecimals ?? 0;
          const token = nonZeroTokenAccounts.find((t: any) => t.mint?.toBase58?.() === lpMint);
          const raw = token?.amount?.toString?.() ?? "0";
          const ui = token?.amount && typeof decimals === "number" ? (Number(token.amount) / Math.pow(10, decimals)).toString() : "0";
          return {
            type: "standard",
            id: pool?.id,
            name: `${pool?.mintA?.symbol || "A"}-${pool?.mintB?.symbol || "B"}`,
            poolType: pool?.type || pool?.poolType || "standard",
            mintA: pool?.mintA,
            mintB: pool?.mintB,
            lpMint,
            lpDecimals: decimals,
            lpAmountRaw: raw,
            lpAmountUi: ui,
            tvl: pool?.tvl?.toString?.() ?? "0",
          };
        })
        .filter((x: any) => x.lpMint && x.lpAmountUi !== "0");
    }

    // 获取 Standard LP 的池子详细信息（计算 pooled amounts）
    // 遍历 standardLpPositions 中的每一个 LP 持仓，补充池子的明细，并计算用户实际持有的 tokenA/tokenB 数量（pooled）
    const standardLpPositionsWithPooled = await Promise.all(
      standardLpPositions.map(async (p: any) => {
        try {
          // =======================
          // 首先尝试通过 CPMM 协议的 RPC 查询池子信息
          // =======================
          // 调用 CPMM 的 getPoolInfoFromRpc 方法，获取池子的实时数据
          const { rpcData } = await raydium.cpmm.getPoolInfoFromRpc(p.id);

          // 用户钱包中实际持有的 LP token 数量
          const userLp = BigInt(p.lpAmountRaw || "0");

          // 池子的总 LP token 数量（即全部流动性提供者的 LP 总和）
          const totalLp = BigInt(rpcData.lpAmount.toString());

          // 用户或池子 LP 数量为 0 时直接返回原数据
          if (userLp === 0n || totalLp === 0n) return p;

          // 池内 tokenA 和 tokenB 的储备量
          const baseReserve = BigInt(rpcData.baseReserve.toString());
          const quoteReserve = BigInt(rpcData.quoteReserve.toString());

          // 用户的 LP 占池子的比例，计算可兑换出来的 tokenA/tokenB 数量
          const amountA = (userLp * baseReserve) / totalLp;
          const amountB = (userLp * quoteReserve) / totalLp;

          // 返回带有 pooled 字段的持仓对象，pooled 描述了换算的 tokenA/tokenB
          return {
            ...p,
            pooled: {
              // tokenA 的 mint 地址，如果取不到则降级为基础数据
              mintA: rpcData.mintA?.toBase58?.() ?? p?.mintA?.address,
              // tokenB 的 mint 地址
              mintB: rpcData.mintB?.toBase58?.() ?? p?.mintB?.address,
              // tokenA、tokenB 的符号
              symbolA: p?.mintA?.symbol,
              symbolB: p?.mintB?.symbol,
              // 用户持有的原始(未格式化) tokenA 和 tokenB 数量（字符串）
              amountARaw: amountA.toString(),
              amountBRaw: amountB.toString(),
              // 按照小数点格式化后的 tokenA 和 tokenB 数量，最多保留 6 位小数
              amountAUi: formatAmount(amountA, Number(rpcData.mintDecimalA), 6),
              amountBUi: formatAmount(amountB, Number(rpcData.mintDecimalB), 6),
            },
          };
        } catch {
          // ===========================
          // 如果不是 CPMM 类型池子，捕获异常后尝试 AMM v4/v5 类型池子的查询
          // ===========================
          try {
            // 使用 liquidity.getPoolInfoFromRpc 获取池子信息，AMM v4/v5 格式
            const { poolRpcData } = await raydium.liquidity.getPoolInfoFromRpc({
              poolId: p.id,
            });

            // 用户钱包中的 LP token 数量
            const userLp = BigInt(p.lpAmountRaw || "0");
            // 池子的总 LP token 数量（AMM v4/v5 的字段为 lpReserve）
            const totalLp = BigInt(poolRpcData.lpReserve.toString());

            // 用户或池子 LP 数量为 0 时直接返回原数据
            if (userLp === 0n || totalLp === 0n) return p;

            // 池内 base（tokenA）、quote（tokenB）的储备量
            const baseReserve = BigInt(poolRpcData.baseReserve.toString());
            const quoteReserve = BigInt(poolRpcData.quoteReserve.toString());

            // 用户占比下，可兑换出来的 tokenA/tokenB
            const amountA = (userLp * baseReserve) / totalLp;
            const amountB = (userLp * quoteReserve) / totalLp;

            // 获取 tokenA（base）和 tokenB（quote）的精度
            const baseDecimals = Number(poolRpcData.baseDecimal?.toString?.() ?? "0");
            const quoteDecimals = Number(poolRpcData.quoteDecimal?.toString?.() ?? "0");

            // 返回包含实际持有 token 资产（pooled）的持仓对象
            return {
              ...p,
              pooled: {
                // tokenA 的 mint
                mintA: poolRpcData.baseMint?.toBase58?.() ?? p?.mintA?.address,
                // tokenB 的 mint
                mintB: poolRpcData.quoteMint?.toBase58?.() ?? p?.mintB?.address,
                // tokenA、tokenB 的 symbol
                symbolA: p?.mintA?.symbol,
                symbolB: p?.mintB?.symbol,
                // 原始/格式化后的数量
                amountARaw: amountA.toString(),
                amountBRaw: amountB.toString(),
                amountAUi: formatAmount(amountA, baseDecimals, 6),
                amountBUi: formatAmount(amountB, quoteDecimals, 6),
              },
            };
          } catch {
            // 如果 AMM v4/v5 查询仍然失败，直接返回原始持仓对象
            return p;
          }
        }
      })
    );

    // 组合所有持仓
    const allPositions = [...standardLpPositionsWithPooled];
    console.log(allPositions, 55555555);
    return allPositions;
  } catch (error: any) {
    console.error("获取持仓失败:", error);
    return [];
  }
}

interface Position {
  type: string;
  id: string;
  name: string;
  poolType: string;
  mintA: {
    logoURI?: string;
    symbol?: string;
  };
  mintB: {
    logoURI?: string;
    symbol?: string;
  };
  tvl: string;
  pooled?: {
    symbolA?: string;
    symbolB?: string;
    amountAUi?: string;
    amountBUi?: string;
  };
}

export default function Page() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const handleAdd = (position: Position) => {
    console.log(position);
  };
  const handleRemove = (position: Position) => {
    console.log(position);
  };
  const handleStake = (position: Position) => {
    console.log(position);
  };
  useEffect(() => {
    const fetchPositions = async () => {
      setLoading(true);
      try {
        const data = await getMyLiquidityPositions();
        setPositions(data);
      } catch (error) {
        console.error("获取持仓失败:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPositions();
  }, []);

  return (
    <>
      <h3 className="text-2xl font-semibold mb-6">流动性持仓查询</h3>
      <ClmmList />
      {positions && positions.length > 0 ? (
        positions.map((position, idx) => (
          <div key={position.id || idx} className="flex flex-row items-start gap-8 mb-5" style={{ display: "flex", justifyContent: "space-around" }}>
            {/* 左侧：流动性池图标与名称 */}
            <div className="flex flex-col items-center">
              <div className="flex gap-2 mb-1">
                <img
                  width={50}
                  height={50}
                  src={position.mintA?.logoURI || "/placeholder-token.png"}
                  alt={position.mintA?.symbol || ""}
                  onError={e => ((e.target as HTMLImageElement).src = "/placeholder-token.png")}
                  className="rounded-full"
                />
                <img
                  width={50}
                  height={50}
                  src={position.mintB?.logoURI || "/placeholder-token.png"}
                  alt={position.mintB?.symbol || ""}
                  onError={e => ((e.target as HTMLImageElement).src = "/placeholder-token.png")}
                  className="rounded-full"
                />
              </div>
              <span>
                {position.mintA?.symbol || "A"} - {position.mintB?.symbol || "B"}
              </span>
            </div>
            {/* 中间-持仓 */}
            <div className="flex flex-col items-center">
              <div className="flex gap-2 mb-1">My Position</div>
              <span>{position.tvl}</span>
            </div>
            {/* 中间-pooled token */}
            <div className="flex flex-col items-center">
              <div className="flex gap-2 mb-1">
                pooled {position.mintA?.symbol || "A"} {position.pooled?.amountAUi || "0"}
              </div>
              <div className="flex gap-2 mb-1">
                pooled {position.mintB?.symbol || "B"} {position.pooled?.amountBUi || "0"}
              </div>
            </div>
            {/* 右侧-操作按钮 */}
            <div className="flex flex-col items-center">
              <div className="flex gap-2 mb-1">
                <button
                  className="w-10 h-10 rounded-lg bg-purple-300 text-purple-700 flex items-center justify-center hover:bg-purple-400 transition-colors"
                  aria-label="Add"
                  onClick={() => handleAdd(position)}
                >
                  +
                </button>
                <button
                  className="w-10 h-10 rounded-lg border-2 border-purple-300 bg-white text-purple-700 flex items-center justify-center hover:bg-purple-50 transition-colors"
                  aria-label="Remove"
                  onClick={() => handleRemove(position)}
                >
                  -
                </button>
                <button
                  className="px-6 h-10 rounded-lg bg-gradient-to-r from-purple-300 to-purple-400 text-white font-medium hover:from-purple-400 hover:to-purple-500 transition-all shadow-sm"
                  aria-label="Stake"
                  onClick={() => handleStake(position)}
                >
                  Stake
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-gray-400 text-center">暂无持仓数据</div>
      )}
    </>
  );
}
