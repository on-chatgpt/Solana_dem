"use client";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState, useCallback } from "react";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
// @ts-ignore - getAssociatedTokenAddress may not be in type definitions
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { getMintDecimals } from "../mintToken/utils/tokenActions";

// 程序 ID
const PROGRAM_ID = new PublicKey("Gc2iWWEfCWHLvTvimc1gUJo4XxX6EgMc5tMArLUFEpBc");
// 从环境变量读取 HHF 代币的 mint 地址
const HHF_MINT_STR = process.env.NEXT_PUBLIC_HHF_TOKEN_MINT || "";
const HHF_MINT = HHF_MINT_STR ? new PublicKey(HHF_MINT_STR) : null;

// 派生池子 PDA：seeds = ["pool", stake_token_mint]
function derivePoolPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("pool"), mint.toBuffer()], PROGRAM_ID);
}

export default function StakeDemo() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [program, setProgram] = useState<Program<any> | null>(null);
  const [decimals, setDecimals] = useState<number>(9);
  const [poolPda, setPoolPda] = useState<PublicKey | null>(null);
  const [poolStakeAta, setPoolStakeAta] = useState<PublicKey | null>(null);
  const [poolRewardAta, setPoolRewardAta] = useState<PublicKey | null>(null);
  const [poolStakeBalance, setPoolStakeBalance] = useState<number>(0);
  const [poolRewardBalance, setPoolRewardBalance] = useState<number>(0);
  const [userHhfBalance, setUserHhfBalance] = useState<number>(0);
  const [userHhfAta, setUserHhfAta] = useState<PublicKey | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // 获取程序IDL
  useEffect(() => {
    if (!connection || !wallet) {
      return;
    }

    async function getProgram() {
      try {
        const provider = new AnchorProvider(connection, wallet as unknown as Wallet, AnchorProvider.defaultOptions());
        const idl = await Program.fetchIdl(PROGRAM_ID, provider);
        if (idl) {
          const fetchedProgram = new Program(idl, provider);
          setProgram(fetchedProgram);
          console.log("Fetched IDL and created Program:", fetchedProgram);
        } else {
          setError("未找到IDL，请确保程序已部署且IDL已初始化");
        }
      } catch (err) {
        console.error("Failed to fetch IDL:", err);
        setError("获取IDL失败: " + (err as Error).message);
      }
    }

    getProgram();
  }, [connection, wallet]);

  // 获取代币精度和派生池子PDA
  useEffect(() => {
    if (!HHF_MINT || !connection) return;
    (async () => {
      try {
        const d = await getMintDecimals(connection, HHF_MINT);
        setDecimals(d);
        const [pool] = derivePoolPda(HHF_MINT);
        setPoolPda(pool);
      } catch (err) {
        console.error("Failed to get decimals or derive pool:", err);
      }
    })();
  }, [connection, HHF_MINT]);

  // 获取用户HHF代币余额
  useEffect(() => {
    if (!wallet.publicKey || !HHF_MINT || !connection) return;
    (async () => {
      try {
        const userAta = await getAssociatedTokenAddress(HHF_MINT, wallet.publicKey!, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
        setUserHhfAta(userAta);

        const accountInfo = await connection.getAccountInfo(userAta);
        if (accountInfo) {
          const balance = await connection.getTokenAccountBalance(userAta);
          const uiBalance = Number(balance.value.amount) / Math.pow(10, balance.value.decimals);
          setUserHhfBalance(uiBalance);
        } else {
          setUserHhfBalance(0);
        }
      } catch (err) {
        console.error("Failed to get user HHF balance:", err);
      }
    })();
  }, [connection, wallet.publicKey, HHF_MINT]);

  // 刷新池子信息
  const refreshPoolInfo = useCallback(async () => {
    if (!HHF_MINT || !poolPda || !connection) return;
    setLoading(true);
    setError("");

    try {
      // 获取池子代币账户（质押池和利息池使用同一个账户，因为mint和owner相同）
      const poolTokenAta = await getAssociatedTokenAddress(HHF_MINT, poolPda, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
      setPoolStakeAta(poolTokenAta);
      setPoolRewardAta(poolTokenAta); // 同一个账户

      // 获取池子代币账户余额（只查询一次，因为两个账户是同一个）
      const accountInfo = await connection.getAccountInfo(poolTokenAta);
      if (accountInfo) {
        const balance = await connection.getTokenAccountBalance(poolTokenAta);
        const uiBalance = Number(balance.value.amount) / Math.pow(10, balance.value.decimals);
        // 由于是同一个账户，质押池和利息池余额相同（都是总余额）
        setPoolStakeBalance(uiBalance);
        setPoolRewardBalance(uiBalance);
      } else {
        setPoolStakeBalance(0);
        setPoolRewardBalance(0);
      }

      // 刷新用户余额
      if (wallet.publicKey) {
        const userAta = await getAssociatedTokenAddress(HHF_MINT, wallet.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
        const userAccountInfo = await connection.getAccountInfo(userAta);
        if (userAccountInfo) {
          const userBalance = await connection.getTokenAccountBalance(userAta);
          const userUi = Number(userBalance.value.amount) / Math.pow(10, userBalance.value.decimals);
          setUserHhfBalance(userUi);
        } else {
          setUserHhfBalance(0);
        }
      }
    } catch (err) {
      console.error("Failed to refresh pool info:", err);
      setError("刷新信息失败: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [connection, HHF_MINT, poolPda, wallet.publicKey]);

  // 初始化时自动刷新
  useEffect(() => {
    if (poolPda && HHF_MINT) {
      refreshPoolInfo();
    }
  }, [poolPda, HHF_MINT, refreshPoolInfo]);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">质押池信息展示</h1>

      <div className="text-sm space-y-1 text-gray-400">
        <div>程序ID：{PROGRAM_ID.toBase58()}</div>
        <div>HHF代币Mint：{HHF_MINT ? HHF_MINT.toBase58() : "未配置（请设置 NEXT_PUBLIC_HHF_TOKEN_MINT）"}</div>
        {program && <div className="text-green-500">✓ IDL已加载</div>}
        {!program && <div className="text-yellow-500">⏳ 正在加载IDL...</div>}
      </div>

      {error && <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}

      {/* 池子代币账户信息（质押池和利息池使用同一个账户） */}
      <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
        <h2 className="text-lg font-semibold mb-3">池子代币账户</h2>
        <div className="mb-2 text-xs text-gray-500 italic">* 质押池和利息池使用同一个账户（因为mint和owner相同）</div>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">账户地址：</span>
            <div className="break-all text-xs font-mono mt-1">{poolStakeAta ? poolStakeAta.toBase58() : "--"}</div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <span className="font-medium text-sm">质押池余额：</span>
              <div className="text-lg font-bold text-green-600 mt-1">{poolStakeBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} HHF</div>
            </div>
            <div>
              <span className="font-medium text-sm">利息池余额：</span>
              <div className="text-lg font-bold text-blue-600 mt-1">{poolRewardBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} HHF</div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
            <span className="font-medium text-sm">账户总余额：</span>
            <div className="text-xl font-bold text-purple-600 mt-1">{poolStakeBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} HHF</div>
          </div>
        </div>
      </div>

      {/* 用户HHF代币余额 */}
      <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
        <h2 className="text-lg font-semibold mb-3">我的HHF代币余额</h2>
        <div className="space-y-2 text-sm">
          {wallet.publicKey ? (
            <>
              <div>
                <span className="font-medium">钱包地址：</span>
                <div className="break-all text-xs font-mono mt-1">{wallet.publicKey.toBase58()}</div>
              </div>
              <div>
                <span className="font-medium">代币账户地址：</span>
                <div className="break-all text-xs font-mono mt-1">{userHhfAta ? userHhfAta.toBase58() : "--"}</div>
              </div>
              <div>
                <span className="font-medium">余额：</span>
                <span className="text-lg font-bold text-purple-600 ml-2">{userHhfBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} HHF</span>
              </div>
            </>
          ) : (
            <div className="text-gray-500">请连接钱包</div>
          )}
        </div>
      </div>

      {/* 刷新按钮 */}
      <div className="flex gap-2">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={refreshPoolInfo}
          disabled={loading || !HHF_MINT || !poolPda}
        >
          {loading ? "刷新中..." : "刷新信息"}
        </button>
      </div>

      {/* 质押池PDA信息（调试用） */}
      <div className="p-3 border rounded text-xs bg-gray-100 dark:bg-gray-900">
        <div className="font-semibold mb-1">质押池PDA：</div>
        <div className="break-all font-mono">{poolPda ? poolPda.toBase58() : "--"}</div>
      </div>
    </div>
  );
}
