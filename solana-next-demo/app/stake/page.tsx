"use client";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState, useCallback } from "react";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
// @ts-ignore - getAssociatedTokenAddress may not be in type definitions
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { getMintDecimals } from "../mintToken/utils/tokenActions";
import * as anchor from "@coral-xyz/anchor";
// 程序 ID
const PROGRAM_ID = new PublicKey("Gc2iWWEfCWHLvTvimc1gUJo4XxX6EgMc5tMArLUFEpBc");
// 从环境变量读取 HHF 代币的 mint 地址
const HHF_MINT_STR = process.env.NEXT_PUBLIC_HHF_TOKEN_MINT || "";
const HHF_MINT = HHF_MINT_STR ? new PublicKey(HHF_MINT_STR) : null;

// 派生质押池 PDA：seeds = ["stake_pool"]
function deriveStakePoolPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("stake_pool")], PROGRAM_ID);
}
// 派生用户质押账户 PDA：seeds = ["user_stake", user, stake_pool]
function deriveUserStakePda(user: PublicKey, stakePool: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("user_stake"), user.toBuffer(), stakePool.toBuffer()], PROGRAM_ID);
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
  const [stakeAmount, setStakeAmount] = useState<string>("");
  const [staking, setStaking] = useState<boolean>(false);
  const [stakePoolData, setStakePoolData] = useState<any>(null);
  const [userStakeData, setUserStakeData] = useState<any>(null);
  const [estimatedInterest, setEstimatedInterest] = useState<number>(0);

  // 获取公共账户地址（用于多个方法）
  const getCommonAccounts = async () => {
    if (!wallet.publicKey || !poolPda || !HHF_MINT || !stakePoolData) {
      throw new Error("缺少必要的参数");
    }

    const stakePoolPda = poolPda;
    const [userStakePda] = deriveUserStakePda(wallet.publicKey, stakePoolPda);
    const userTokenAccount = await getAssociatedTokenAddress(HHF_MINT, wallet.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const stakeTokenAccount = new PublicKey(stakePoolData.stakeTokenAccount);
    const interestTokenAccount = new PublicKey(stakePoolData.interestTokenAccount);

    return {
      stakePoolPda,
      userStakePda,
      userTokenAccount,
      stakeTokenAccount,
      interestTokenAccount,
    };
  };

  // 1. 质押HHF代币
  async function stake() {
    if (!program) {
      throw new Error("程序未加载");
    }

    setStaking(true);
    setError("");

    try {
      const amountValue = parseFloat(stakeAmount);
      if (isNaN(amountValue) || amountValue <= 0) {
        throw new Error("请输入有效的质押金额");
      }
      if (amountValue > userHhfBalance) {
        throw new Error("质押金额不能超过您的余额");
      }

      const amount = BigInt(Math.floor(amountValue * Math.pow(10, decimals)));
      const accounts = await getCommonAccounts();

      console.log("质押参数:", {
        stakePoolPda: accounts.stakePoolPda.toBase58(),
        userStakePda: accounts.userStakePda.toBase58(),
        userTokenAccount: accounts.userTokenAccount.toBase58(),
        stakeTokenAccount: accounts.stakeTokenAccount.toBase58(),
        amount: amount.toString(),
      });

      const tx = await (program.methods as any)
        .stake(new anchor.BN(amount.toString()))
        .accounts({
          user: wallet.publicKey,
          stakePool: accounts.stakePoolPda,
          userStake: accounts.userStakePda,
          userTokenAccount: accounts.userTokenAccount,
          stakeTokenAccount: accounts.stakeTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("质押成功！交易签名:", tx);
      setStakeAmount("");
      await refreshPoolInfo();
      await fetchUserStakeInfo();
    } catch (err: any) {
      console.error("质押失败:", err);
      setError("质押失败: " + (err.message || String(err)));
      throw err;
    } finally {
      setStaking(false);
    }
  }

  // 2. 领取利息（只领取利息，不领取本金）
  async function claimInterest() {
    if (!program) {
      throw new Error("程序未加载");
    }

    setLoading(true);
    setError("");

    try {
      const accounts = await getCommonAccounts();

      console.log("领取利息参数:", {
        stakePoolPda: accounts.stakePoolPda.toBase58(),
        userStakePda: accounts.userStakePda.toBase58(),
        userTokenAccount: accounts.userTokenAccount.toBase58(),
        interestTokenAccount: accounts.interestTokenAccount.toBase58(),
      });

      const tx = await (program.methods as any)
        .claimInterest()
        .accounts({
          user: wallet.publicKey,
          stakePool: accounts.stakePoolPda,
          userStake: accounts.userStakePda,
          stakePoolAccount: accounts.stakePoolPda, // PDA账户，用作签名者
          userTokenAccount: accounts.userTokenAccount,
          interestTokenAccount: accounts.interestTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("领取利息成功！交易签名:", tx);
      await refreshPoolInfo();
      await fetchUserStakeInfo();
    } catch (err: any) {
      console.error("领取利息失败:", err);
      setError("领取利息失败: " + (err.message || String(err)));
      throw err;
    } finally {
      setLoading(false);
    }
  }

  // 3. 全部领取（本金+利息）
  async function claimAll() {
    if (!program) {
      throw new Error("程序未加载");
    }

    setLoading(true);
    setError("");

    try {
      const accounts = await getCommonAccounts();

      console.log("全部领取参数:", {
        stakePoolPda: accounts.stakePoolPda.toBase58(),
        userStakePda: accounts.userStakePda.toBase58(),
        userTokenAccount: accounts.userTokenAccount.toBase58(),
        stakeTokenAccount: accounts.stakeTokenAccount.toBase58(),
        interestTokenAccount: accounts.interestTokenAccount.toBase58(),
      });

      const tx = await (program.methods as any)
        .claimAll()
        .accounts({
          user: wallet.publicKey,
          stakePool: accounts.stakePoolPda,
          userStake: accounts.userStakePda,
          stakePoolAccount: accounts.stakePoolPda, // PDA账户，用作签名者
          userTokenAccount: accounts.userTokenAccount,
          stakeTokenAccount: accounts.stakeTokenAccount,
          interestTokenAccount: accounts.interestTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("全部领取成功！交易签名:", tx);
      await refreshPoolInfo();
      await fetchUserStakeInfo();
    } catch (err: any) {
      console.error("全部领取失败:", err);
      setError("全部领取失败: " + (err.message || String(err)));
      throw err;
    } finally {
      setLoading(false);
    }
  }

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

  // 获取代币精度和派生质押池PDA
  useEffect(() => {
    if (!HHF_MINT || !connection) return;
    (async () => {
      try {
        const d = await getMintDecimals(connection, HHF_MINT);
        setDecimals(d);
        const [pool] = deriveStakePoolPda();
        setPoolPda(pool);
      } catch (err) {
        console.error("Failed to get decimals or derive pool:", err);
      }
    })();
  }, [connection, HHF_MINT]);

  // 获取质押池账户数据
  useEffect(() => {
    if (!program || !poolPda) return;
    (async () => {
      try {
        console.log("poolPda", poolPda.toBase58(), 11);
        const stakePool = await (program.account as any).stakePool.fetch(poolPda);
        setStakePoolData(stakePool);
        console.log("StakePool data:", stakePool);
      } catch (err) {
        console.error("Failed to fetch StakePool:", err);
        // 如果账户不存在，这是正常的（可能还未初始化）
      }
    })();
  }, [program, poolPda]);

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

  // 获取用户质押信息
  const fetchUserStakeInfo = useCallback(async () => {
    if (!program || !wallet.publicKey || !poolPda) return;

    try {
      const [userStakePda] = deriveUserStakePda(wallet.publicKey, poolPda);
      const userStake = await (program.account as any).userStake.fetch(userStakePda);
      setUserStakeData(userStake);

      // 计算预计收益
      if (userStake && userStake.stakedAmount > 0) {
        const currentTime = Math.floor(Date.now() / 1000); // 当前时间（秒）
        const lastUpdateTime = Number(userStake.lastUpdateTime);
        const minutesElapsed = Math.floor((currentTime - lastUpdateTime) / 60);

        if (minutesElapsed > 0) {
          // 计算新产生的利息：本金 * 0.001 * 分钟数
          const stakedAmount = Number(userStake.stakedAmount);
          const newInterest = (stakedAmount * 0.001 * minutesElapsed) / Math.pow(10, decimals);
          const accruedInterest = Number(userStake.accruedInterest) / Math.pow(10, decimals);
          const totalEstimatedInterest = newInterest + accruedInterest;
          setEstimatedInterest(totalEstimatedInterest);
        } else {
          // 只显示已累计的利息
          const accruedInterest = Number(userStake.accruedInterest) / Math.pow(10, decimals);
          setEstimatedInterest(accruedInterest);
        }
      } else {
        setUserStakeData(null);
        setEstimatedInterest(0);
      }
    } catch (err) {
      // 用户可能还没有质押记录，这是正常的
      console.log("用户尚未质押或获取质押信息失败:", err);
      setUserStakeData(null);
      setEstimatedInterest(0);
    }
  }, [program, wallet.publicKey, poolPda, decimals]);

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

      // 刷新用户质押信息
      if (program && wallet.publicKey && poolPda) {
        await fetchUserStakeInfo();
      }
    } catch (err) {
      console.error("Failed to refresh pool info:", err);
      setError("刷新信息失败: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [connection, HHF_MINT, poolPda, wallet.publicKey, program, fetchUserStakeInfo]);

  // 初始化时自动刷新
  useEffect(() => {
    if (poolPda && HHF_MINT) {
      refreshPoolInfo();
    }
  }, [poolPda, HHF_MINT, refreshPoolInfo]);

  // 当程序、钱包或质押池变化时，获取用户质押信息
  useEffect(() => {
    if (program && wallet.publicKey && poolPda) {
      fetchUserStakeInfo();
      // 每30秒更新一次预计收益
      const interval = setInterval(fetchUserStakeInfo, 30000);
      return () => clearInterval(interval);
    }
  }, [program, wallet.publicKey, poolPda, fetchUserStakeInfo]);

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

      {/* 我的质押信息 */}
      {wallet.publicKey && program && poolPda && (
        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <h2 className="text-lg font-semibold mb-3">我的质押信息</h2>
          <div className="space-y-3">
            {userStakeData && userStakeData.stakedAmount > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">质押总量</span>
                    <div className="text-xl font-bold text-green-600 mt-1">
                      {(Number(userStakeData.stakedAmount) / Math.pow(10, decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} HHF
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">预计收益</span>
                    <div className="text-xl font-bold text-blue-600 mt-1">{estimatedInterest.toLocaleString(undefined, { maximumFractionDigits: 6 })} HHF</div>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-300 dark:border-gray-600">
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>首次质押时间: {new Date(Number(userStakeData.stakeTime) * 1000).toLocaleString()}</div>
                    <div>最后更新时间: {new Date(Number(userStakeData.lastUpdateTime) * 1000).toLocaleString()}</div>
                    <div>已累计利息: {(Number(userStakeData.accruedInterest) / Math.pow(10, decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} HHF</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <div>您还没有质押记录</div>
                <div className="text-xs mt-1">开始质押后，这里将显示您的质押总量和预计收益</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 质押功能 */}
      {wallet.publicKey && program && stakePoolData && (
        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <h2 className="text-lg font-semibold mb-3">质押 HHF 代币</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">质押金额 (HHF)</label>
              <input
                type="number"
                step="0.000001"
                min="0"
                max={userHhfBalance}
                value={stakeAmount}
                onChange={e => setStakeAmount(e.target.value)}
                placeholder="请输入质押金额"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              />
              <div className="text-xs text-gray-500 mt-1">可用余额: {userHhfBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} HHF</div>
            </div>
            <button
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={stake}
              disabled={staking || !stakeAmount || parseFloat(stakeAmount) <= 0 || parseFloat(stakeAmount) > userHhfBalance}
            >
              {staking ? "质押中..." : "质押"}
            </button>
          </div>
        </div>
      )}

      {/* 领取功能 */}
      {wallet.publicKey && program && stakePoolData && (
        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <h2 className="text-lg font-semibold mb-3">领取收益</h2>
          <div className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">您可以领取已产生的利息，或同时领取利息和本金</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={async () => {
                  try {
                    await claimInterest();
                  } catch (err) {
                    // 错误已在 claimInterest 方法中处理
                  }
                }}
                disabled={loading || staking}
              >
                {loading ? "处理中..." : "领取利息"}
              </button>
              <button
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={async () => {
                  try {
                    await claimAll();
                  } catch (err) {
                    // 错误已在 claimAll 方法中处理
                  }
                }}
                disabled={loading || staking}
              >
                {loading ? "处理中..." : "全部领取"}
              </button>
            </div>
          </div>
        </div>
      )}

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
