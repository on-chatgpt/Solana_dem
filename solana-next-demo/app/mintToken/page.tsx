"use client";
import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import TokenList from "./modules/TokenList";
import CreateMint from "./modules/CreateMint";
import CreateATA from "./modules/CreateATA";
import MintTokens from "./modules/MintTokens";
import IpfsTool from "./modules/ifps";
import SetMetadata from "./modules/SetMetadata";
import styles from "./module/mintToken.module.css";
import type { MintTokenSharedState, MintTokenSharedUpdater } from "./types";

const TABS = [
  { key: "list", label: "代币列表" },
  { key: "transfer", label: "转账" },
  { key: "createMint", label: "创建代币" },
  { key: "createAta", label: "关联铸币账户" },
  { key: "mintTokens", label: "铸造代币" },
  { key: "ipfs", label: "IPFS" },
  { key: "metadata", label: "设置Metadata" },
] as const;

export default function MintTokenPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("list");
  const [headerError, setHeaderError] = useState<string>("");
  const [state, setState] = useState<MintTokenSharedState>({
    walletAddress: "",
    solBalance: 0,
    tokens: [],
  });

  // 钱包是否可用可通过 WalletActions 控件与模块内部自行判断

  // 初始与变更时刷新地址与余额（异步调度，避免同步 setState 报警）
  useEffect(() => {
    queueMicrotask(async () => {
      if (!wallet.publicKey) return;
      try {
        setHeaderError("");
        const addr = wallet.publicKey.toBase58();
        const lamports = await connection.getBalance(wallet.publicKey);
        setState((prev) => ({
          ...prev,
          walletAddress: addr,
          solBalance: lamports / LAMPORTS_PER_SOL,
        }));
      } catch (error) {
        console.error("获取钱包余额失败:", error);
        const message = error instanceof Error ? error.message : String(error);
        setHeaderError(`余额查询失败：${message}`);
      }
    });
  }, [connection, wallet.publicKey]);

  const update = (patch: MintTokenSharedUpdater) =>
    setState((prev) => ({ ...prev, ...patch }));

  return (
    <div className={styles.pageDark}>
      <div className={styles.header}>
        <div style={{ fontWeight: 600 }}>Solana Token Manager</div>
        <div className={styles.headerInfo}>
          <span>地址：{state.walletAddress || "--"}</span>
          <span>
            SOL：{state.solBalance ? state.solBalance.toFixed(6) : "--"}
          </span>
        </div>
      </div>
      {headerError && (
        <div className={styles.page}>
          <div className={styles.resultRow}>{headerError}</div>
        </div>
      )}

      <div className={styles.page}>
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={styles.tabBtn}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "list" && (
          <TokenList
            onTokens={(list) => update({ tokens: list })}
            onGotoTransfer={() => setTab("transfer")}
            onGotoMint={(mint) => {
              update({ createdMint: mint });
              setTab("mintTokens");
            }}
            onGotoMetadata={(mint) => {
              update({ createdMint: mint });
              setTab("metadata");
            }}
          />
        )}
        {tab === "createMint" && (
          <CreateMint
            createdMint={state.createdMint}
            createMintSig={state.createMintSig}
            onCreated={(mint, sig) =>
              update({ createdMint: mint, createMintSig: sig })
            }
          />
        )}
        {tab === "createAta" && (
          <CreateATA
            defaultMint={state.createdMint}
            createdAta={state.createdAta}
            createAtaSig={state.createAtaSig}
            onCreated={(ata, sig) =>
              update({ createdAta: ata, createAtaSig: sig })
            }
          />
        )}
        {tab === "mintTokens" && (
          <MintTokens
            defaultMint={state.createdMint}
            defaultOwner={undefined}
            lastMintToSig={state.lastMintToSig}
            onMinted={(sig, usedAta) =>
              update({ lastMintToSig: sig, createdAta: usedAta })
            }
          />
        )}
        {tab === "transfer" && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>转账（占位）</div>
            <div className={styles.resultRow}>后续将实现 SPL/原生 SOL 转账</div>
          </div>
        )}
        {tab === "ipfs" && (
          <IpfsTool
            onImageUploaded={(url, cid) =>
              update({ ipfsImageUrl: url, ipfsImageCid: cid })
            }
            onJsonUploaded={(url, cid) =>
              update({ ipfsJsonUrl: url, ipfsJsonCid: cid })
            }
          />
        )}
        {tab === "metadata" && (
          <SetMetadata
            defaultMint={state.createdMint}
            defaultUri={state.ipfsJsonUrl}
          />
        )}
      </div>
    </div>
  );
}
