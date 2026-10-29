"use client";
import request from "../utils/request";
import { useEffect, useState } from "react";
import axios from "axios";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { raydiumSwap } from "./utils/swapTransaction";

async function getQuote(params: any) {
  const response = await request.get("/quote", { params });
  return response;
}
async function getRaydiumSwapQuoteDevnet(params: { inputMint: string; outputMint: string; amount: string; slippageBps: number; txVersion?: string }) {
  const url = "https://transaction-v1-devnet.raydium.io/compute/swap-base-in";

  const requestParams = {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageBps: params.slippageBps,
    txVersion: params.txVersion || "V0",
  };

  const { data } = await axios.get(url, { params: requestParams });

  return data;
}
const TOKENS = {
  SOL: {
    symbol: "SOL",
    name: "Solana",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  HHF: {
    symbol: "HHF",
    name: "HHF",
    mint: process.env.NEXT_PUBLIC_HHF_TOKEN_MINT || "",
    decimals: 9,
    logoURI: "",
  },
};
export default function SwapPlaceholder() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [slippageBps, setSlippageBps] = useState("0.5");
  const [inputMint, setInputMint] = useState("SOL");
  const [outputMint, setOutputMint] = useState("HHF");
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [routePlan, setRoutePlan] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [swapError, setSwapError] = useState("");
  const [swapSuccess, setSwapSuccess] = useState("");
  const handleSwap = async () => {
    if (!wallet.connected) {
      alert("请先连接钱包");
      return;
    }

    // 验证输入数量
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setSwapError("请输入有效的兑换数量");
      return;
    }

    // 验证是否有报价数据
    if (!quoteData) {
      setSwapError("请先获取报价");
      return;
    }

    setSwapLoading(true);
    setSwapError("");
    setSwapSuccess("");

    try {
      const txid = await raydiumSwap({ wallet, quoteData });

      console.log("swap tx:", txid);
      setSwapSuccess(`兑换成功！交易ID: ${txid}`);

      // 清空输入框
      setInputAmount("");
      setOutputAmount("");
      setQuoteData(null);
      setRoutePlan([]);
    } catch (error: any) {
      console.error("兑换失败:", error);
      setSwapError(error?.message || "兑换失败，请重试");
    } finally {
      setSwapLoading(false);
    }
  };
  const setInputMintFun = (value: string) => {
    setInputMint(value);
    // 保证 outputMint 和 inputMint 互斥
    // 如果 outputMint 与 value 重合，则自动切换 outputMint 为另一个 token
    if (value === outputMint) {
      const availableOutput = Object.keys(TOKENS).find(key => key !== value);
      if (availableOutput) setOutputMint(availableOutput);
    }
    // setInputAmount(0);
    // setOutputAmount(0);
  };
  const setInputAmountFun = (value: string) => {
    // 允许输入小数，只允许数字和小数点
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setInputAmount(value);
      if (value === "" || value === ".") {
        setOutputAmount("");
        setRoutePlan([]);
        setQuoteData(null); // 清空 quote 数据
        return;
      }
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue > 0) {
        swapAmount(numValue);
      } else {
        setOutputAmount("");
        setRoutePlan([]);
        setQuoteData(null); // 清空 quote 数据
      }
    }
  };
  // 计算兑换的代币数量
  async function swapAmount(amount?: number) {
    const currentAmount = amount !== undefined ? amount : parseFloat(inputAmount);

    if (!currentAmount || currentAmount <= 0 || isNaN(currentAmount)) {
      setOutputAmount("");
      setRoutePlan([]);
      return;
    }

    setLoading(true);
    try {
      const inputToken = TOKENS[inputMint as keyof typeof TOKENS];
      const outputToken = TOKENS[outputMint as keyof typeof TOKENS];

      // 将输入金额转换为 lamports (最小单位)
      const amountInLamports = Math.floor(currentAmount * Math.pow(10, inputToken.decimals)).toString();

      const quote = await getRaydiumSwapQuoteDevnet({
        inputMint: inputToken.mint,
        outputMint: outputToken.mint,
        amount: amountInLamports,
        slippageBps: Math.floor(parseFloat(slippageBps) * 100),
        txVersion: "V0",
      });

      // 检查接口是否成功
      if (quote.success && quote.data) {
        // 保存 quote 数据，用于后续 swap
        setQuoteData(quote);

        // 将 outputAmount 从 lamports 转换为可读格式
        const outputAmountInLamports = BigInt(quote.data.outputAmount);
        const outputAmountReadable = Number(outputAmountInLamports) / Math.pow(10, outputToken.decimals);
        setOutputAmount(outputAmountReadable.toString());

        // 保存 routePlan 信息
        if (quote.data.routePlan) {
          setRoutePlan(quote.data.routePlan);
        }
      } else {
        // 接口返回失败（如 INSUFFICIENT_LIQUIDITY），清空输出
        console.error("获取报价失败:", quote.msg || "未知错误");
        setOutputAmount("");
        setRoutePlan([]);
        setQuoteData(null); // 清空 quote 数据
      }
    } catch (error) {
      console.error("获取报价失败:", error);
      setOutputAmount("");
      setRoutePlan([]);
      setQuoteData(null); // 清空 quote 数据
    } finally {
      setLoading(false);
    }
  }
  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      {/* 滑点设置下拉框 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 8 }}>滑点设置:</label>
        <select value={slippageBps} onChange={e => setSlippageBps(e.target.value)}>
          <option value="0.5">0.5%</option>
          <option value="1">1%</option>
          <option value="2">2%</option>
        </select>
      </div>
      {/* 输入框1 */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <select style={{ marginRight: 8 }} value={inputMint} onChange={e => setInputMintFun(e.target.value)}>
          {Object.keys(TOKENS).map(key => (
            <option value={key} key={key}>
              {TOKENS[key as keyof typeof TOKENS].symbol}
            </option>
          ))}
        </select>
        <input type="number" step="any" style={{ flex: 1, padding: 4 }} placeholder="输入数量" value={inputAmount} onChange={e => setInputAmountFun(e.target.value)} />
      </div>
      {/* 输入框2 */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <select style={{ marginRight: 8 }} value={outputMint} disabled>
          {Object.keys(TOKENS).map(key => (
            <option value={key} key={key}>
              {TOKENS[key as keyof typeof TOKENS].symbol}
            </option>
          ))}
        </select>
        <input style={{ flex: 1, padding: 4 }} placeholder="输入数量" value={outputAmount} readOnly />
      </div>

      {/* 显示池子信息 */}
      {routePlan.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
          <div style={{ marginBottom: 8, fontWeight: "bold" }}>路由信息:</div>
          {routePlan.map((route, index) => (
            <div key={index} style={{ marginBottom: 8, fontSize: 12 }}>
              <div>池子 ID: {route.poolId}</div>
              <div>
                输入: {route.inputMint.slice(0, 8)}... → 输出: {route.outputMint.slice(0, 8)}...
              </div>
              <div>手续费率: {route.feeRate / 10000}%</div>
            </div>
          ))}
        </div>
      )}

      {loading && <div style={{ marginTop: 8, color: "#666" }}>加载中...</div>}

      {swapError && <div style={{ marginTop: 8, padding: 8, backgroundColor: "#fee", color: "#c00", borderRadius: 4, fontSize: 12 }}>错误: {swapError}</div>}

      {swapSuccess && <div style={{ marginTop: 8, padding: 8, backgroundColor: "#efe", color: "#060", borderRadius: 4, fontSize: 12 }}>{swapSuccess}</div>}

      <button style={{ marginTop: 16 }} onClick={handleSwap} disabled={loading || swapLoading || !wallet.connected || !quoteData}>
        {swapLoading ? "交易中..." : "兑换"}
      </button>
    </div>
  );
}
