"use client";
import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import styles from "../module/mintToken.module.css";
import { createMint, DEFAULT_DECIMALS } from "../utils/tokenActions";

interface Props {
  createdMint?: PublicKey;
  createMintSig?: string;
  onCreated: (mint: PublicKey, sig: string) => void;
}

export default function CreateMint({
  createdMint,
  createMintSig,
  onCreated,
}: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [decimals, setDecimals] = useState<number>(DEFAULT_DECIMALS);
  const [freezeAuthority, setFreezeAuthority] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const disabled = !wallet.connected || !wallet.publicKey;

  const handleCreate = async () => {
    try {
      setLoading(true);
      if (!wallet.publicKey) return;
      const freeze = freezeAuthority ? new PublicKey(freezeAuthority) : null;
      const { mint, signature } = await createMint(
        connection,
        wallet,
        decimals,
        freeze
      );
      onCreated(mint, signature);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>创建代币</div>
      <div className={styles.formRow}>
        <label>精度（decimals）</label>
        <input
          className={styles.input}
          type="number"
          min={0}
          max={9}
          value={decimals}
          onChange={(e) => setDecimals(parseInt(e.target.value || "0", 10))}
        />
      </div>
      <div className={styles.formRow}>
        <label>冻结权限地址（可选）</label>
        <input
          className={styles.input}
          placeholder="PublicKey"
          value={freezeAuthority}
          onChange={(e) => setFreezeAuthority(e.target.value)}
        />
      </div>
      <div className={styles.actionsRow}>
        <button className={styles.primaryBtn} onClick={handleCreate} disabled={disabled || loading}>
          {loading ? "处理中..." : "创建代币"}
        </button>
      </div>
      <div className={styles.resultRow}>
        mint：{createdMint?.toBase58() || "尚未创建"}
      </div>
      <div className={styles.resultRow}>交易签名：{createMintSig || "--"}</div>
    </div>
  );
}
