import { NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Raydium } from "@raydium-io/raydium-sdk-v2";

function getClusterEnv(): "devnet" | "mainnet" {
  // 强制开发环境：确保所有操作都在 devnet
  const c = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "").toLowerCase();
  // Next/Solana wallet-adapter 常见值：devnet | testnet | mainnet-beta
  // 如果明确设置了 mainnet，才返回 mainnet；否则强制 devnet
  if (c === "mainnet-beta" || c === "mainnet") {
    console.warn("⚠️ API: 检测到 mainnet 配置，但建议使用 devnet 进行开发");
    return "mainnet";
  }
  // 默认强制 devnet（开发环境）
  return "devnet";
}

function getRpcEndpoint(): string {
  // 允许单独给服务端配置更稳定的 RPC
  const fromEnv =
    process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (fromEnv) return fromEnv;

  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER as
    | "devnet"
    | "testnet"
    | "mainnet-beta"
    | undefined;
  return clusterApiUrl(cluster || "devnet");
}

function getApiBaseHost(): string {
  return getClusterEnv() === "mainnet"
    ? "https://api-v3.raydium.io"
    : "https://api-v3-devnet.raydium.io";
}

function formatAmount(
  raw: bigint,
  decimals: number,
  maxFracDigits = 6
): string {
  if (decimals <= 0) return raw.toString();
  const s = raw.toString();
  const pad = decimals - s.length;
  const full = pad > 0 ? "0".repeat(pad) + s : s;
  const intPart =
    full.length > decimals ? full.slice(0, full.length - decimals) : "0";
  let fracPart = full.slice(full.length - decimals).replace(/0+$/, "");
  if (maxFracDigits >= 0 && fracPart.length > maxFracDigits)
    fracPart = fracPart.slice(0, maxFracDigits).replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

function serializeClmmPosition(p: any) {
  return {
    nftMint: p.nftMint?.toBase58?.() ?? String(p.nftMint),
    poolId: p.poolId?.toBase58?.() ?? String(p.poolId),
    tickLower: Number(p.tickLower),
    tickUpper: Number(p.tickUpper),
    liquidity: p.liquidity?.toString?.() ?? String(p.liquidity),
    tokenFeesOwedA: p.tokenFeesOwedA?.toString?.() ?? String(p.tokenFeesOwedA),
    tokenFeesOwedB: p.tokenFeesOwedB?.toString?.() ?? String(p.tokenFeesOwedB),
    rewardInfos: Array.isArray(p.rewardInfos)
      ? p.rewardInfos.map((r: any) => ({
          growthInsideLastX64:
            r.growthInsideLastX64?.toString?.() ??
            String(r.growthInsideLastX64),
          rewardAmountOwed:
            r.rewardAmountOwed?.toString?.() ?? String(r.rewardAmountOwed),
        }))
      : [],
  };
}

async function getMintDecimalsFromRpc(
  connection: Connection,
  mint: PublicKey
): Promise<number> {
  const info = await connection.getParsedAccountInfo(mint, "confirmed");
  const parsed: any = info.value?.data;
  const decimals = parsed?.parsed?.info?.decimals;
  return typeof decimals === "number" ? decimals : 0;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerStr = searchParams.get("owner") || "";
    const tokenMintStr = searchParams.get("tokenMint") || "";
    const extraPoolIdsStr = searchParams.get("extraPoolIds") || "";

    if (!ownerStr) {
      return NextResponse.json({ error: "missing owner" }, { status: 400 });
    }

    let owner: PublicKey;
    try {
      owner = new PublicKey(ownerStr);
    } catch {
      return NextResponse.json({ error: "invalid owner" }, { status: 400 });
    }

    const endpoint = getRpcEndpoint();
    const connection = new Connection(endpoint, "confirmed");
    const cluster = getClusterEnv();

    const raydium = await Raydium.load({
      connection,
      owner,
      cluster,
      disableFeatureCheck: true,
      disableLoadToken: true,
      blockhashCommitment: "confirmed",
    });

    const [positions, locked] = await Promise.all([
      raydium.clmm.getOwnerPositionInfo({}),
      raydium.clmm.getOwnerLockedPositionInfo({}),
    ]);

    // Standard/CPMM positions（Portfolio 里 “Standard” 那块基本对应 LP token 持仓）
    await raydium.account.fetchWalletTokenAccounts();
    const allTokenAccounts = raydium.account.tokenAccounts;
    const nonZeroTokenAccounts = raydium.account.tokenAccounts.filter(
      (t: any) => !t.amount?.isZero?.()
    );
    const lpMintCandidates = Array.from(
      new Set(
        nonZeroTokenAccounts
          .map((t: any) => t.mint?.toBase58?.())
          .filter(Boolean)
      )
    ) as string[];

    let standardPools: any[] = [];
    if (lpMintCandidates.length) {
      const baseHost = getApiBaseHost();
      const url = `${baseHost}/pools/info/lps?lps=${lpMintCandidates.join(
        ","
      )}`;
      const r = await fetch(url, { method: "GET" });
      const j: any = await r.json().catch(() => ({}));
      const data = Array.isArray(j?.data)
        ? j.data
        : Array.isArray(j?.data?.data)
        ? j.data.data
        : [];
      standardPools = data;
    }

    const standardLpPositions = standardPools
      .map((pool: any) => {
        const lpMint = pool?.lpMint?.address;
        const decimals = pool?.lpMint?.decimals ?? pool?.lpMintDecimals ?? 0;
        const token = nonZeroTokenAccounts.find(
          (t: any) => t.mint?.toBase58?.() === lpMint
        );
        const raw = token?.amount?.toString?.() ?? "0";
        const ui =
          token?.amount && typeof decimals === "number"
            ? (Number(token.amount) / Math.pow(10, decimals)).toString()
            : "0";
        return {
          id: pool?.id,
          name: `${pool?.mintA?.symbol || "A"}-${pool?.mintB?.symbol || "B"}`,
          poolType: pool?.type || pool?.poolType || "standard",
          mintA: pool?.mintA,
          mintB: pool?.mintB,
          lpMint,
          lpDecimals: decimals,
          lpAmountRaw: raw,
          lpAmountUi: ui,
        };
      })
      .filter((x: any) => x.lpMint);

    // 兜底：允许前端直接指定 poolId（新建池子还没被 Raydium API 收录时也能查到）
    const extraPoolIds = Array.from(
      new Set(
        extraPoolIdsStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );

    const extraStandardPositions = await Promise.all(
      extraPoolIds.map(async (poolId) => {
        try {
          const { poolInfo, rpcData } = await raydium.cpmm.getPoolInfoFromRpc(
            poolId
          );
          const lpMint =
            rpcData.mintLp?.toBase58?.() ?? poolInfo.lpMint?.address;
          const lpDecimals =
            rpcData.lpDecimals ?? poolInfo.lpMint?.decimals ?? 0;
          const tokenAcc = allTokenAccounts.find(
            (t: any) => t.mint?.toBase58?.() === lpMint
          );
          const lpAmountRaw = tokenAcc?.amount?.toString?.() ?? "0";
          const lpAmountUi =
            tokenAcc?.amount && typeof lpDecimals === "number"
              ? (Number(tokenAcc.amount) / Math.pow(10, lpDecimals)).toString()
              : "0";

          const userLp = BigInt(lpAmountRaw || "0");
          const totalLp = BigInt(rpcData.lpAmount.toString());
          const baseReserve = BigInt(rpcData.baseReserve.toString());
          const quoteReserve = BigInt(rpcData.quoteReserve.toString());
          const amountA =
            totalLp === 0n ? 0n : (userLp * baseReserve) / totalLp;
          const amountB =
            totalLp === 0n ? 0n : (userLp * quoteReserve) / totalLp;

          const mintAAddr =
            rpcData.mintA?.toBase58?.() ?? poolInfo.mintA?.address;
          const mintBAddr =
            rpcData.mintB?.toBase58?.() ?? poolInfo.mintB?.address;

          return {
            id: poolId,
            name: `${
              poolInfo.mintA?.symbol || mintAAddr?.slice?.(0, 6) || "A"
            }-${poolInfo.mintB?.symbol || mintBAddr?.slice?.(0, 6) || "B"}`,
            poolType: "standard",
            mintA: poolInfo.mintA,
            mintB: poolInfo.mintB,
            lpMint,
            lpDecimals,
            lpAmountRaw,
            lpAmountUi,
            pooled: {
              mintA: mintAAddr,
              mintB: mintBAddr,
              symbolA: poolInfo.mintA?.symbol,
              symbolB: poolInfo.mintB?.symbol,
              amountARaw: amountA.toString(),
              amountBRaw: amountB.toString(),
              amountAUi: formatAmount(amountA, Number(rpcData.mintDecimalA), 6),
              amountBUi: formatAmount(amountB, Number(rpcData.mintDecimalB), 6),
            },
          };
        } catch {
          // AMM v4/v5 fallback
          try {
            const { poolRpcData } = await raydium.liquidity.getPoolInfoFromRpc({
              poolId,
            });
            const lpMint = poolRpcData.lpMint?.toBase58?.();
            const lpDecimals = lpMint
              ? await getMintDecimalsFromRpc(connection, new PublicKey(lpMint))
              : 0;
            const tokenAcc = allTokenAccounts.find(
              (t: any) => t.mint?.toBase58?.() === lpMint
            );
            const lpAmountRaw = tokenAcc?.amount?.toString?.() ?? "0";
            const lpAmountUi =
              tokenAcc?.amount && typeof lpDecimals === "number"
                ? (
                    Number(tokenAcc.amount) / Math.pow(10, lpDecimals)
                  ).toString()
                : "0";

            const userLp = BigInt(lpAmountRaw || "0");
            const totalLp = BigInt(poolRpcData.lpReserve.toString());
            const baseReserve = BigInt(poolRpcData.baseReserve.toString());
            const quoteReserve = BigInt(poolRpcData.quoteReserve.toString());
            const amountA =
              totalLp === 0n ? 0n : (userLp * baseReserve) / totalLp;
            const amountB =
              totalLp === 0n ? 0n : (userLp * quoteReserve) / totalLp;

            const baseDecimals = Number(
              poolRpcData.baseDecimal?.toString?.() ?? "0"
            );
            const quoteDecimals = Number(
              poolRpcData.quoteDecimal?.toString?.() ?? "0"
            );

            return {
              id: poolId,
              name: `${
                poolRpcData.baseMint?.toBase58?.()?.slice?.(0, 6) || "A"
              }-${poolRpcData.quoteMint?.toBase58?.()?.slice?.(0, 6) || "B"}`,
              poolType: "legacy",
              mintA: {
                address: poolRpcData.baseMint?.toBase58?.(),
                decimals: baseDecimals,
              },
              mintB: {
                address: poolRpcData.quoteMint?.toBase58?.(),
                decimals: quoteDecimals,
              },
              lpMint,
              lpDecimals,
              lpAmountRaw,
              lpAmountUi,
              pooled: {
                mintA: poolRpcData.baseMint?.toBase58?.(),
                mintB: poolRpcData.quoteMint?.toBase58?.(),
                symbolA: undefined,
                symbolB: undefined,
                amountARaw: amountA.toString(),
                amountBRaw: amountB.toString(),
                amountAUi: formatAmount(amountA, baseDecimals, 6),
                amountBUi: formatAmount(amountB, quoteDecimals, 6),
              },
            };
          } catch {
            return null;
          }
        }
      })
    );

    const extraStandardPositionsClean = extraStandardPositions.filter(Boolean);

    // 把 LP 数量换算成底层 token 数量（pooled A/B），用于对齐 raydium.io/portfolio 的展示
    const standardLpPositionsWithPooled = await Promise.all(
      standardLpPositions.map(async (p: any) => {
        try {
          const { rpcData } = await raydium.cpmm.getPoolInfoFromRpc(p.id);
          const userLp = BigInt(p.lpAmountRaw || "0");
          const totalLp = BigInt(rpcData.lpAmount.toString());
          if (userLp === 0n || totalLp === 0n) return p;

          const baseReserve = BigInt(rpcData.baseReserve.toString());
          const quoteReserve = BigInt(rpcData.quoteReserve.toString());
          const amountA = (userLp * baseReserve) / totalLp;
          const amountB = (userLp * quoteReserve) / totalLp;

          return {
            ...p,
            pooled: {
              mintA: rpcData.mintA?.toBase58?.() ?? p?.mintA?.address,
              mintB: rpcData.mintB?.toBase58?.() ?? p?.mintB?.address,
              symbolA: p?.mintA?.symbol,
              symbolB: p?.mintB?.symbol,
              amountARaw: amountA.toString(),
              amountBRaw: amountB.toString(),
              amountAUi: formatAmount(amountA, Number(rpcData.mintDecimalA), 6),
              amountBUi: formatAmount(amountB, Number(rpcData.mintDecimalB), 6),
            },
          };
        } catch {
          // 不是 CPMM 的 standard 池（可能是 AMM v4/v5），fallback 用 liquidity 模块
          try {
            const { poolRpcData } = await raydium.liquidity.getPoolInfoFromRpc({
              poolId: p.id,
            });

            const userLp = BigInt(p.lpAmountRaw || "0");
            const totalLp = BigInt(poolRpcData.lpReserve.toString());
            if (userLp === 0n || totalLp === 0n) return p;

            const baseReserve = BigInt(poolRpcData.baseReserve.toString());
            const quoteReserve = BigInt(poolRpcData.quoteReserve.toString());
            const amountA = (userLp * baseReserve) / totalLp;
            const amountB = (userLp * quoteReserve) / totalLp;

            const baseDecimals = Number(
              poolRpcData.baseDecimal?.toString?.() ?? "0"
            );
            const quoteDecimals = Number(
              poolRpcData.quoteDecimal?.toString?.() ?? "0"
            );

            return {
              ...p,
              pooled: {
                mintA: poolRpcData.baseMint?.toBase58?.() ?? p?.mintA?.address,
                mintB: poolRpcData.quoteMint?.toBase58?.() ?? p?.mintB?.address,
                symbolA: p?.mintA?.symbol,
                symbolB: p?.mintB?.symbol,
                amountARaw: amountA.toString(),
                amountBRaw: amountB.toString(),
                amountAUi: formatAmount(amountA, baseDecimals, 6),
                amountBUi: formatAmount(amountB, quoteDecimals, 6),
              },
            };
          } catch {
            // 仍失败就先返回 LP 数量
            return p;
          }
        }
      })
    );

    const mergedStandard = Array.from(
      new Map(
        [...standardLpPositionsWithPooled, ...extraStandardPositionsClean].map(
          (p: any) => [p.id, p]
        )
      ).values()
    );

    // 可选：按 tokenMint 过滤（用于只看某个代币相关的 positions）
    let filteredPositions = positions;
    let filteredLocked = locked;
    let filteredStandard = mergedStandard;
    if (tokenMintStr) {
      let tokenMint: PublicKey;
      try {
        tokenMint = new PublicKey(tokenMintStr);
      } catch {
        return NextResponse.json(
          { error: "invalid tokenMint" },
          { status: 400 }
        );
      }

      const poolIds = Array.from(
        new Set([
          ...positions.map(
            (p: any) => p.poolId?.toBase58?.() ?? String(p.poolId)
          ),
          ...locked.map(
            (x: any) =>
              x.position?.poolId?.toBase58?.() ?? String(x.position?.poolId)
          ),
        ])
      );

      const poolKeys = await raydium.api.fetchPoolKeysById({ idList: poolIds });
      const poolHasMint = new Map<string, boolean>();
      for (const k of poolKeys as any[]) {
        const id = String(k.id);
        const a = k.mintA?.address ? String(k.mintA.address) : "";
        const b = k.mintB?.address ? String(k.mintB.address) : "";
        poolHasMint.set(
          id,
          a === tokenMint.toBase58() || b === tokenMint.toBase58()
        );
      }

      filteredPositions = positions.filter((p: any) => {
        const id = p.poolId?.toBase58?.() ?? String(p.poolId);
        return poolHasMint.get(id);
      });

      filteredLocked = locked.filter((x: any) => {
        const id =
          x.position?.poolId?.toBase58?.() ?? String(x.position?.poolId);
        return poolHasMint.get(id);
      });

      const tokenMintB58 = tokenMint.toBase58();
      filteredStandard = mergedStandard.filter((p: any) => {
        const a = p?.mintA?.address || p?.mintA?.mint || p?.mintA;
        const b = p?.mintB?.address || p?.mintB?.mint || p?.mintB;
        return a === tokenMintB58 || b === tokenMintB58;
      });
    }

    return NextResponse.json(
      {
        endpoint,
        cluster,
        owner: owner.toBase58(),
        positions: filteredPositions.map(serializeClmmPosition),
        lockedPositions: filteredLocked.map((x: any) => ({
          position: serializeClmmPosition(x.position),
          lockInfo: {
            lockOwner:
              x.lockInfo?.lockOwner?.toBase58?.() ??
              String(x.lockInfo?.lockOwner),
            poolId:
              x.lockInfo?.poolId?.toBase58?.() ?? String(x.lockInfo?.poolId),
            positionId:
              x.lockInfo?.positionId?.toBase58?.() ??
              String(x.lockInfo?.positionId),
            nftAccount:
              x.lockInfo?.nftAccount?.toBase58?.() ??
              String(x.lockInfo?.nftAccount),
            lockNftMint:
              x.lockInfo?.lockNftMint?.toBase58?.() ??
              String(x.lockInfo?.lockNftMint),
            recentEpoch:
              x.lockInfo?.recentEpoch?.toString?.() ??
              String(x.lockInfo?.recentEpoch),
          },
        })),
        standardLpPositions: filteredStandard,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.message || "unknown error",
      },
      { status: 500 }
    );
  }
}
