"use client";
import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import styles from "../module/mintToken.module.css";
import { createAta } from "../utils/tokenActions";

interface Props {
  defaultMint?: PublicKey;
  createdAta?: PublicKey;
  createAtaSig?: string;
  onCreated: (ata: PublicKey, sig: string) => void;
}

export default function CreateATA({ defaultMint, createdAta, createAtaSig, onCreated }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [mint, setMint] = useState<string>(defaultMint?.toBase58() || "");
  const [owner, setOwner] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const disabled = !wallet.connected || !wallet.publicKey;

  useEffect(() => {
    if (defaultMint) setMint(defaultMint.toBase58());
  }, [defaultMint]);

  const handleCreateAta = async () => {
    try {
      setLoading(true);
      if (!wallet.publicKey) return;
      const mintPk = new PublicKey(mint);
      const ownerPk = new PublicKey(owner || wallet.publicKey);
      // 默认使用 allowOwnerOffCurve = true，以支持 PDA 作为 owner
      // 对于普通地址，这个参数设置为 true 也能正常工作
      const allowOwnerOffCurve = true;

      console.log("创建ATA参数:", {
        mint: mintPk.toBase58(),
        owner: ownerPk.toBase58(),
        allowOwnerOffCurve,
        wallet: wallet.publicKey.toBase58(),
      });

      const { ata, signature } = await createAta(connection, wallet, mintPk, ownerPk, allowOwnerOffCurve);

      console.log("ATA创建成功:", {
        ata: ata.toBase58(),
        signature,
      });

      onCreated(ata, signature);
    } catch (error) {
      console.error("创建ATA失败:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`创建ATA失败: ${errorMessage}\n\n请检查:\n1. 钱包是否已连接\n2. 是否有足够的SOL支付手续费\n3. 如果owner是PDA，请确保PDA地址正确`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>关联铸币账户（ATA）</div>
      <div className={styles.formRow}>
        <label>mint 地址</label>
        <input className={styles.input} value={mint} onChange={e => setMint(e.target.value)} />
      </div>
      <div className={styles.formRow}>
        <label>账户所有者（默认当前钱包）</label>
        <input className={styles.input} value={owner} onChange={e => setOwner(e.target.value)} />
      </div>
      <div className={styles.actionsRow}>
        <button className={styles.primaryBtn} onClick={handleCreateAta} disabled={disabled || !mint || loading}>
          {loading ? "处理中..." : "创建 ATA"}
        </button>
      </div>
      <div className={styles.resultRow}>ATA：{createdAta?.toBase58() || "--"}</div>
      <div className={styles.resultRow}>交易签名：{createAtaSig || "--"}</div>
    </div>
  );
}
