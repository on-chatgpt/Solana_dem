"use client";
import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import styles from "../module/mintToken.module.css";
// @ts-ignore - getAssociatedTokenAddress may not be in type definitions
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getMintDecimals, mintTo, toBaseUnits } from "../utils/tokenActions";

interface Props {
  defaultMint?: PublicKey;
  defaultOwner?: PublicKey;
  lastMintToSig?: string;
  onMinted: (sig: string, usedAta: PublicKey) => void;
}

export default function MintTokens({ defaultMint, defaultOwner, lastMintToSig, onMinted }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [mint, setMint] = useState<string>(defaultMint?.toBase58() || "");
  const [destOwner, setDestOwner] = useState<string>(defaultOwner?.toBase58() || "");
  const [amount, setAmount] = useState<number>(0);
  const [ataAddr, setAtaAddr] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const disabled = !wallet.connected || !wallet.publicKey;

  useEffect(() => {
    if (defaultMint) setMint(defaultMint.toBase58());
  }, [defaultMint]);
  useEffect(() => {
    if (defaultOwner) setDestOwner(defaultOwner.toBase58());
  }, [defaultOwner]);

  const handleMintTo = async () => {
    try {
      setLoading(true);
      if (!wallet.publicKey) return;
      const mintPk = new PublicKey(mint);
      const ownerPk = new PublicKey(destOwner || wallet.publicKey);
      const decimals = await getMintDecimals(connection, mintPk);
      // 当owner是PDA时，allowOwnerOffCurve必须为true
      // 这里默认使用true，以支持PDA作为owner的情况
      const allowOwnerOffCurve = true;
      // @ts-ignore - getAssociatedTokenAddress 的类型定义可能不完整
      const ata = await getAssociatedTokenAddress(mintPk, ownerPk, allowOwnerOffCurve);
      setAtaAddr(ata.toBase58());
      const amountBase = toBaseUnits(amount, decimals);

      // 调试信息：打印实际铸造的数量
      console.log("铸造信息：", {
        mint: mintPk.toBase58(),
        owner: ownerPk.toBase58(),
        ata: ata.toBase58(),
        amount: amount,
        decimals: decimals,
        amountBase: amountBase.toString(),
        amountBaseNumber: Number(amountBase),
      });

      // 传递owner和allowOwnerOffCurve参数，以便在ATA不存在时自动创建
      const { signature } = await mintTo(connection, wallet, mintPk, ata, amountBase, ownerPk, allowOwnerOffCurve);

      // 等待交易确认
      console.log("等待交易确认...", signature);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("交易已确认！");

      onMinted(signature, ata);
    } catch (error) {
      console.error("铸造失败：", error);
      alert(`铸造失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>铸造代币</div>
      <div className={styles.formRow}>
        <label>mint 地址</label>
        <input className={styles.input} value={mint} onChange={e => setMint(e.target.value)} />
      </div>
      <div className={styles.formRow}>
        <label>接收者地址（默认当前钱包）</label>
        <input className={styles.input} value={destOwner} onChange={e => setDestOwner(e.target.value)} />
      </div>
      <div className={styles.formRow}>
        <label>数量（人类可读单位）</label>
        <input className={styles.input} type="number" min={0} step="0.000001" value={amount} onChange={e => setAmount(parseFloat(e.target.value || "0"))} />
      </div>
      <div className={styles.actionsRow}>
        <button className={styles.primaryBtn} onClick={handleMintTo} disabled={disabled || !mint || amount <= 0 || loading}>
          {loading ? "处理中..." : "铸造"}
        </button>
      </div>
      <div className={styles.resultRow}>ATA：{ataAddr || "--"}</div>
      <div className={styles.resultRow}>交易签名：{lastMintToSig || "--"}</div>
    </div>
  );
}
