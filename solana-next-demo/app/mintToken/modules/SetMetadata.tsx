"use client";
import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import styles from "../module/mintToken.module.css";
import {
  createMetadata,
  hasMetadata,
  updateMetadata,
} from "../utils/tokenMetadata";

type Mode = "create" | "update";

interface Props {
  defaultMint?: PublicKey;
  defaultUri?: string;
}

export default function SetMetadata({ defaultMint, defaultUri }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [mode, setMode] = useState<Mode>("create");
  const [mint, setMint] = useState<string>(defaultMint?.toBase58() || "");
  const [name, setName] = useState<string>("");
  const [symbol, setSymbol] = useState<string>("");
  const [uri, setUri] = useState<string>(defaultUri || "");
  const [exists, setExists] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [signature, setSignature] = useState<string>("");
  const disabled = useMemo(
    () => !wallet.connected || !wallet.publicKey,
    [wallet.connected, wallet.publicKey]
  );

  useEffect(() => {
    if (defaultMint) setMint(defaultMint.toBase58());
  }, [defaultMint]);

  useEffect(() => {
    if (defaultUri) setUri(defaultUri);
  }, [defaultUri]);

  useEffect(() => {
    const run = async () => {
      try {
        if (!mint) return;
        const ok = await hasMetadata(connection, new PublicKey(mint));
        setExists(ok);
        if (ok) setMode("update");
      } catch {}
    };
    queueMicrotask(() => {
      void run();
    });
  }, [connection, mint]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      if (!wallet.publicKey) return;
      const mintPk = new PublicKey(mint);
      const sig =
        mode === "create"
          ? await createMetadata(connection, wallet, mintPk, name, symbol, uri)
          : await updateMetadata(connection, wallet, mintPk, name, symbol, uri);
      setSignature(sig);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>设置代币 Metadata</div>
      <div className={styles.actionsRow}>
        <button
          className={styles.primaryBtn}
          onClick={() => setMode("create")}
          disabled={loading}
        >
          创建新元数据
        </button>
        <button
          className={styles.primaryBtn}
          onClick={() => setMode("update")}
          disabled={loading || !exists}
        >
          更新现有元数据
        </button>
      </div>
      <div className={styles.formRow}>
        <input
          className={styles.input}
          value={mint}
          onChange={(e) => setMint(e.target.value)}
          placeholder="mint 地址"
        />
      </div>
      <div className={styles.formRow}>
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="代币名称"
        />
      </div>
      <div className={styles.formRow}>
        <input
          className={styles.input}
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="代币符号"
        />
      </div>
      <div className={styles.formRow}>
        <input
          className={styles.input}
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          placeholder="元数据 URI（可选）"
        />
      </div>
      <div className={styles.actionsRow}>
        <button
          className={styles.primaryBtn}
          onClick={handleSubmit}
          disabled={disabled || !mint || !name || !symbol || loading}
        >
          {loading ? "处理中..." : "设置 Metadata"}
        </button>
      </div>
      <div className={styles.resultRow}>
        当前状态：{exists ? "已存在，可更新" : "未设置，可创建"}
      </div>
      <div className={styles.resultRow}>交易签名：{signature || "--"}</div>
    </div>
  );
}
