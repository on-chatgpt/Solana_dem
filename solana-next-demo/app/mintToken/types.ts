import type { PublicKey } from "@solana/web3.js";

export interface TokenAccountItem {
  // 代币 mint 地址
  mint: PublicKey;
  // 关联账户（ATA）地址
  ata: PublicKey;
  // 余额（最小单位）
  amount: bigint;
  // 精度（小数位）
  decimals: number;
}

export interface CreateMintResult {
  // 新建的代币 mint 地址
  mint: PublicKey;
  // 交易签名
  signature: string;
}

export interface CreateAtaResult {
  ata: PublicKey;
  signature: string;
}

export interface MintToResult {
  signature: string;
}

// 页面共享状态：用于在不同模块切换时保持数据不丢失
export interface MintTokenSharedState {
  walletAddress: string;
  solBalance: number;
  tokens: TokenAccountItem[];
  // 创建代币的结果
  createdMint?: PublicKey;
  createMintSig?: string;
  // 创建 ATA 的结果
  createdAta?: PublicKey;
  createAtaSig?: string;
  // 最近一次铸造交易签名
  lastMintToSig?: string;
  // IPFS 上传结果
  ipfsImageUrl?: string;
  ipfsImageCid?: string;
  ipfsJsonUrl?: string;
  ipfsJsonCid?: string;
}

export type MintTokenSharedUpdater = Partial<MintTokenSharedState>;
