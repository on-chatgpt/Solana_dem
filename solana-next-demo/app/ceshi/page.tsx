"use client";
import { useEffect } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import { Connection, PublicKey } from "@solana/web3.js";
import { Jupiter } from "@jup-ag/core";
import axios from "axios";
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const WALLET = new PublicKey("97xPWeBz5UJFaX1HkVDBU5mjnfznTHs8GmpzyS4AFfEr");

const DEVNET_QUOTE_URL = "https://transaction-v1-devnet.raydium.io/compute/swap-base-in";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const TARGET_MINT = "CUBCxykvZF3iMKdKQMfXow87YKqAc7RB58mbckF8pG2t";
const SOL_DECIMALS = 9;
async function getQuote() {
  const { data } = await axios.post("http://localhost:3010/quote", {
    mintIn: "So11111111111111111111111111111111111111112",
    mintOut: "CUBCxykvZF3iMKdKQMfXow87YKqAc7RB58mbckF8pG2t",
    amountIn: "1",
    decimals: 9,
  });
  console.log(data, 45);
}
async function getQuote2() {
  const { data } = await axios.post("https://api.devnet.solana.com", {
    method: "getMultipleAccounts",
    jsonrpc: "2.0",
    params: [["8AxyvanuBNMJrzs63LbUrsTCPPZ6VoA6g57S7Sv2ob6e"], { encoding: "base64", commitment: "confirmed" }],
    id: "c9848fc7-344e-4484-b02e-18eefe7884c9",
  });
  console.log(data, 45);
}
async function getAllPools() {
  try {
    const { data } = await axios.get(`http://localhost:3009/debug/test-pools`);

    console.log(data, 45);
  } catch (error) {
    console.error("获取池子列表失败:", error);
  }
}
async function getSwapPrice() {
  const SOL_MINT = "So11111111111111111111111111111111111111112";
  const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
  const ONE_SOL = 1_000_000_000;
  const { data } = await axios.get("https://lite-api.jup.ag/swap/v1/quote", {
    params: {
      inputMint: SOL_MINT,
      outputMint: USDT_MINT,
      amount: ONE_SOL,
      slippageBps: 10, // 0.1%，只为 quote
      onlyDirectRoutes: false,
    },
  });

  const price = Number(data.outAmount) / 1_000_000;
  console.log(price);
}

async function getPolls() {
  // 获取池子列表
  const response = await axios.get("https://api.raydium.io/v2/main/pairs");

  const pools = response.data;
  console.log(`找到 ${pools.length} 个池子`);

  // 显示池子信息
  pools.slice(0, 10).forEach((pool: any) => {
    console.log(`━━━ ${pool.name} ━━━`);
    console.log(`Token Pair: ${pool.baseMint} / ${pool.quoteMint}`);
    console.log(`TVL: $${pool.tvl}`);
    console.log(`Volume 24h: $${pool.volume24h}`);
    console.log();
  });
}
export default function Page() {
  return (
    <>
      <h3>获取swap价格</h3>
      <button onClick={getAllPools}>获取所有池子</button>
      <button onClick={getQuote}>获取swap价格</button>
      <button onClick={getSwapPrice}>获取主网价格</button>
      <button onClick={getPolls}>获取池子列表</button>
      <button onClick={getQuote2}>getQuote2</button>
    </>
  );
}
