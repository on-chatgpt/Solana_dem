"use client"; // 客户端组件：需要访问钱包与浏览器注入对象
import { useCallback, useContext, useMemo, useState } from "react"; // React 基本 hooks
import { useConnection, useWallet } from "@solana/wallet-adapter-react"; // 钱包适配器 hooks
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js"; // Web3 基础工具与常量

const DEFAULT_AMOUNT_SOL = 0.001; // 默认转账金额（单位 SOL）
const FEE_BUFFER_LAMPORTS = 5_000; // 预估手续费缓冲（约 0.000005 SOL）

export default function StakePage() {
  const { connection } = useConnection(); // 当前 RPC 连接（由全局 Provider 提供）
  const { publicKey, sendTransaction, connected } = useWallet(); // 钱包地址、发送交易方法、连接状态
  const endpoint = useContext(SolanaEndpointContext);

  const [address, setAddress] = useState<string>("");
  const [balanceSol, setBalanceSol] = useState<number>(0);
  const [toAddress, setToAddress] = useState<string>("");
  const [amountSol, setAmountSol] = useState<number>(DEFAULT_AMOUNT_SOL);
  const [txSig, setTxSig] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  // 按钮禁用条件：未连接或没有公钥
  const disabled = useMemo(
    () => !connected || !publicKey,
    [connected, publicKey]
  );

  // 读取钱包地址并显示
  const handleReadAddress = useCallback(() => {
    if (!publicKey) return;
    setAddress(publicKey.toBase58());
  }, [publicKey]);

  // 查询当前钱包 SOL 余额（单位 SOL）
  const handleFetchBalance = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const lamports = await connection.getBalance(publicKey);
      setBalanceSol(lamports / LAMPORTS_PER_SOL);
      setErrorMsg("");
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  // 基于 SystemProgram.transfer 发送原生 SOL 转账
  const handleTransfer = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      setErrorMsg("");
      const currentLamports = await connection.getBalance(publicKey);
      const toPubkey = new PublicKey(toAddress);
      const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
      const required = lamports + FEE_BUFFER_LAMPORTS;
      if (currentLamports < required) {
        setErrorMsg(
          `余额不足：当前 ${(currentLamports / LAMPORTS_PER_SOL).toFixed(
            6
          )} SOL，需 ${(required / LAMPORTS_PER_SOL).toFixed(
            6
          )} SOL（含手续费）`
        );
        return;
      }
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: publicKey, toPubkey, lamports })
      );
      const signature = await sendTransaction(tx, connection);
      setTxSig(signature);
    } finally {
      setLoading(false);
    }
  }, [publicKey, toAddress, amountSol, sendTransaction, connection]);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Stake 工具方法示例</h1>
      <div className="text-xs opacity-70">当前网络 RPC：{endpoint}</div>
      {/* 如需显示当前连接的网络，可由 Provider 暴露 endpoint 字符串 */}

      <div className="space-y-2">
        <button
          className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          onClick={handleReadAddress}
          disabled={disabled}
        >
          读取钱包地址
        </button>
        <div className="text-sm">地址：{address || "未读取"}</div>
      </div>

      <div className="space-y-2">
        <button
          className="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50"
          onClick={handleFetchBalance}
          disabled={disabled || loading}
        >
          查询余额
        </button>
        <div className="text-sm">
          余额：{balanceSol ? `${balanceSol} SOL` : "未查询"}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            className="flex-1 px-2 py-1 rounded border"
            placeholder="接收地址"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
          />
          <input
            className="w-40 px-2 py-1 rounded border"
            type="number"
            step="0.000001"
            min={0}
            placeholder="SOL 数量"
            value={amountSol}
            onChange={(e) => setAmountSol(parseFloat(e.target.value) || 0)}
          />
          <button
            className="px-3 py-2 rounded bg-purple-600 text-white disabled:opacity-50"
            onClick={handleTransfer}
            disabled={disabled || loading || !toAddress || amountSol <= 0}
          >
            发送转账
          </button>
        </div>
        <div className="text-sm break-all">交易签名：{txSig || "未发送"}</div>
        {errorMsg && (
          <div className="text-xs text-red-600 break-all">{errorMsg}</div>
        )}
      </div>
    </div>
  );
}
import { SolanaEndpointContext } from "@/components/SolanaWalletProvider";
