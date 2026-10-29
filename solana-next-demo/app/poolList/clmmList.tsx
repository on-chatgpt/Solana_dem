"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { Connection, PublicKey } from "@solana/web3.js";
import { clusterApiUrl } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const WALLET = new PublicKey("97xPWeBz5UJFaX1HkVDBU5mjnfznTHs8GmpzyS4AFfEr");

// 池子数据类型定义
interface PoolInfo {
  type: string;
  programId: string;
  id: string;
  mintA: {
    address: string;
    logoURI: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  mintB: {
    address: string;
    logoURI: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  price: number;
  mintAmountA: number;
  mintAmountB: number;
  tvl: number;
  day: {
    priceMin: number;
    priceMax: number;
  };
}

// 获取clmm
async function getClmmPoolIds(walletAddress: string) {
  try {
    const response = await axios.get(`https://owner-v1-devnet.raydium.io/create-pool/${walletAddress}`);
    console.log("第一步 - 获取池子列表:", response.data);

    // 只获取 clmm 类型的池子
    const clmmPools = response.data?.data?.clmm || [];
    const poolIds = clmmPools.map((pool: any) => pool.id);

    console.log("CLMM 池子 IDs:", poolIds);
    return poolIds;
  } catch (error) {
    console.error("获取池子 ID 失败:", error);
    return [];
  }
}

// 获取池子详细信息
async function getPoolInfo(poolIds: string[]) {
  if (poolIds.length === 0) {
    console.log("没有池子 ID，跳过详细信息获取");
    return [];
  }

  try {
    const idsParam = poolIds.join(",");
    const response = await axios.get(`https://api-v3-devnet.raydium.io/pools/info/ids?ids=${idsParam}`);
    console.log("第二步 - 获取池子详细信息:", response.data);
    return response.data?.data || [];
  } catch (error) {
    console.error("获取池子详细信息失败:", error);
    return [];
  }
}

// 获取 CLMM 池子完整信息
async function fetchClmmPools(walletAddress: string) {
  console.log("开始获取 CLMM 池子信息...");
  console.log("钱包地址:", walletAddress);

  // 第一步：获取池子 ID
  const poolIds = await getClmmPoolIds(walletAddress);

  if (poolIds.length === 0) {
    console.log("未找到 CLMM 池子");
    return [];
  }

  // 第二步：获取池子详细信息
  const poolInfos = await getPoolInfo(poolIds);

  console.log("最终获取到的 CLMM 池子信息:", poolInfos);
  return poolInfos;
}

export default function ClmmList() {
  const [poolInfos, setPoolInfos] = useState<PoolInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPools = async () => {
      setLoading(true);
      const pools = await fetchClmmPools(WALLET.toString());
      setPoolInfos(pools);
      setLoading(false);
    };

    loadPools();
  }, []);

  if (loading) {
    return <div>加载中...</div>;
  }

  if (poolInfos.length === 0) {
    return <div>未找到 CLMM 池子</div>;
  }

  return (
    <>
      <div>ClmmList</div>
      {poolInfos.map(pool => {
        // 计算价格范围显示
        const priceMin = pool.day.priceMin || 0;
        const priceMax = pool.day.priceMax || 0;
        const priceRange = priceMin > 0 && priceMax > 0 ? `${priceMin}-${priceMax} ${pool.mintA.symbol} per ${pool.mintB.symbol}` : `价格范围暂无数据`;

        // 当前价格显示
        const currentPrice = `${pool.price} ${pool.mintA.symbol} PER ${pool.mintB.symbol}`;

        return (
          <div key={pool.id} style={{ marginBottom: "20px", padding: "16px", border: "1px solid #ccc", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <img src={pool.mintA.logoURI} alt={pool.mintA.symbol} style={{ width: "24px", height: "24px", borderRadius: "50%" }} />
              <img src={pool.mintB.logoURI} alt={pool.mintB.symbol} style={{ width: "24px", height: "24px", borderRadius: "50%" }} />
              <span>
                {pool.mintA.symbol}/{pool.mintB.symbol}
              </span>
              <span style={{ marginLeft: "16px", fontWeight: "bold" }}>CURRENT PRICE {currentPrice}</span>
            </div>
            <div style={{ color: "#666", fontSize: "14px" }}>
              {priceRange} | Position ${pool.tvl.toFixed(2)} |
            </div>
          </div>
        );
      })}
    </>
  );
}
