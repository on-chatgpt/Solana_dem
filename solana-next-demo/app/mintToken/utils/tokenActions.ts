import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { CreateAtaResult, CreateMintResult, MintToResult } from "../types";

// 常量：默认精度与手续费缓冲
export const DEFAULT_DECIMALS = 9;
export const FEE_BUFFER_LAMPORTS = 5_000;

// 创建新代币并初始化 mint
export async function createMint(connection: Connection, wallet: WalletContextState, decimals: number = DEFAULT_DECIMALS, freezeAuthority: PublicKey | null = null): Promise<CreateMintResult> {
  if (!wallet.publicKey) throw new Error("钱包未连接");
  const feePayer = wallet.publicKey;

  // 计算租金并创建账户
  const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  const mintKp = Keypair.generate();

  const tx = new Transaction();
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: feePayer,
      newAccountPubkey: mintKp.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    })
  );
  tx.add(
    createInitializeMint2Instruction(
      mintKp.publicKey,
      decimals,
      feePayer, // 将当前钱包设置为 mint authority
      freezeAuthority
    )
  );

  // 设置交易必要字段后再对新账户进行签名
  const { blockhash } = await connection.getLatestBlockhash();
  tx.feePayer = feePayer;
  tx.recentBlockhash = blockhash;
  // 由新账户与当前钱包共同签名（钱包签名在 sendTransaction 内完成）
  tx.partialSign(mintKp);
  const signature = await wallet.sendTransaction(tx, connection);

  return { mint: mintKp.publicKey, signature };
}

// 创建/获取关联代币账户（ATA）
// allowOwnerOffCurve: 当owner是PDA时，必须设置为true
export async function createAta(connection: Connection, wallet: WalletContextState, mint: PublicKey, owner: PublicKey, allowOwnerOffCurve: boolean = false): Promise<CreateAtaResult> {
  if (!wallet.publicKey) throw new Error("钱包未连接");
  const feePayer = wallet.publicKey;
  
  // 根据项目中其他地方的用法，使用3个参数的方式
  // @ts-ignore - getAssociatedTokenAddress 的类型定义可能不完整
  const ata = await getAssociatedTokenAddress(mint, owner, allowOwnerOffCurve);

  // 检查ATA是否已存在
  const accountInfo = await connection.getAccountInfo(ata);
  if (accountInfo) {
    console.log("ATA账户已存在:", ata.toBase58());
    // 如果已存在，返回一个虚拟签名（实际上不需要创建）
    return { ata, signature: "already_exists" };
  }

  const ix = createAssociatedTokenAccountInstruction(feePayer, ata, owner, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  
  // 设置交易的必要字段
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = feePayer;
  tx.add(ix);
  
  try {
    // 使用 sendTransaction 的选项，确保交易能够正确发送
    const signature = await wallet.sendTransaction(tx, connection, {
      skipPreflight: false,
      maxRetries: 3,
    });
    
    // 等待交易确认
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, "confirmed");
    
    return { ata, signature };
  } catch (error) {
    console.error("创建ATA失败:", {
      error,
      mint: mint.toBase58(),
      owner: owner.toBase58(),
      ata: ata.toBase58(),
      allowOwnerOffCurve,
      feePayer: feePayer.toBase58(),
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(`创建ATA失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 向指定 ATA 铸造代币（如果 ATA 不存在会自动创建）
// destOwner: 目标账户的 owner，用于创建 ATA（如果不存在）
// allowOwnerOffCurve: 当owner是PDA时，必须设置为true
export async function mintTo(
  connection: Connection,
  wallet: WalletContextState,
  mint: PublicKey,
  destAta: PublicKey,
  amountBaseUnits: bigint,
  destOwner?: PublicKey,
  allowOwnerOffCurve: boolean = false
): Promise<MintToResult> {
  if (!wallet.publicKey) throw new Error("钱包未连接");

  const tx = new Transaction();

  // 检查 ATA 是否存在，如果不存在则创建
  const accountInfo = await connection.getAccountInfo(destAta);
  if (!accountInfo && destOwner) {
    // ATA 不存在，需要创建
    const createAtaIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey, // payer
      destAta,
      destOwner,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    tx.add(createAtaIx);
  }

  // 添加铸造指令
  // 当前钱包必须是 mint authority
  const mintIx = createMintToInstruction(mint, destAta, wallet.publicKey, Number(amountBaseUnits));
  tx.add(mintIx);

  const signature = await wallet.sendTransaction(tx, connection);
  return { signature };
}

// 工具：将用户输入的数量转换为最小单位
export function toBaseUnits(amount: number, decimals: number): bigint {
  const scaled = Math.round(amount * Math.pow(10, decimals));
  return BigInt(scaled);
}

export async function getMintDecimals(connection: Connection, mint: PublicKey): Promise<number> {
  const info = await getMint(connection, mint);
  return info.decimals;
}
