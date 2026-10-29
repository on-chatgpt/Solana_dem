"use client";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  ParsedAccountData,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SolanaEndpointContext } from "@/components/SolanaWalletProvider";
import type { TokenAccountItem } from "../types";
import styles from "../module/mintToken.module.css";

interface Props {
  onTokens?: (list: TokenAccountItem[]) => void;
  onGotoTransfer?: (mint: PublicKey, ata: PublicKey) => void;
  onGotoMint?: (mint: PublicKey, owner: PublicKey) => void;
  onGotoMetadata?: (mint: PublicKey) => void;
}

export default function TokenList({
  onTokens,
  onGotoTransfer,
  onGotoMint,
  onGotoMetadata,
}: Props) {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const endpoint = useContext(SolanaEndpointContext);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [tokens, setTokens] = useState<TokenAccountItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const disabled = useMemo(
    () => !connected || !publicKey,
    [connected, publicKey]
  );
  const tokenListUnsupported = useMemo(
    () =>
      endpoint.includes("chainstack.com") &&
      endpoint.includes("solana-mainnet"),
    [endpoint]
  );
  const tokenListUnsupportedMessage =
    "当前 Chainstack 主网免费套餐不支持代币列表查询。它限制了 getTokenAccountsByOwner 方法，但创建代币、铸造和设置 Metadata 仍可继续。";

  const formatRpcError = useCallback(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Method requires plan upgrade")) {
        return tokenListUnsupportedMessage;
      }
      return `加载代币列表失败：${message}`;
    },
    [tokenListUnsupportedMessage]
  );

  const fetchSolBalance = useCallback(async () => {
    if (!publicKey) return;
    try {
      const lamports = await connection.getBalance(publicKey);
      setSolBalance(lamports / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error("获取 SOL 余额失败:", error);
      setErrorMessage(formatRpcError(error));
    }
  }, [connection, formatRpcError, publicKey]);

  const fetchTokens = useCallback(async () => {
    if (!publicKey) return;
    if (tokenListUnsupported) {
      setTokens([]);
      onTokens?.([]);
      setErrorMessage(tokenListUnsupportedMessage);
      return;
    }
    try {
      setErrorMessage("");
      const res = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });
      const list: TokenAccountItem[] = res.value.map((it) => {
        const data = it.account.data as ParsedAccountData;
        type TokenParsedInfo = {
          mint: string;
          owner: string;
          address?: string;
          tokenAmount: {
            amount: string;
            decimals: number;
            uiAmount?: number;
            uiAmountString?: string;
          };
        };
        const parsed = data.parsed as unknown as { info: TokenParsedInfo };
        const info = parsed.info;
        const tokenAmount = info.tokenAmount ?? { amount: "0", decimals: 0 };
        const mintStr = info.mint;
        const addressStr = info.address ?? it.pubkey.toBase58();
        return {
          mint: new PublicKey(mintStr),
          ata: new PublicKey(addressStr),
          amount: BigInt(tokenAmount.amount),
          decimals: tokenAmount.decimals,
        };
      });
      setTokens(list);
      onTokens?.(list);
    } catch (error) {
      console.error("获取代币列表失败:", error);
      setTokens([]);
      onTokens?.([]);
      setErrorMessage(formatRpcError(error));
    }
  }, [
    connection,
    formatRpcError,
    onTokens,
    publicKey,
    tokenListUnsupported,
    tokenListUnsupportedMessage,
  ]);

  // 连接钱包后自动拉取列表与余额（通过异步调度规避同步 setState 检查）
  useEffect(() => {
    if (!publicKey) return;
    Promise.resolve().then(async () => {
      await fetchSolBalance();
      if (tokenListUnsupported) {
        setTokens([]);
        onTokens?.([]);
        setErrorMessage(tokenListUnsupportedMessage);
        return;
      }
      await fetchTokens();
    });
  }, [
    fetchSolBalance,
    fetchTokens,
    onTokens,
    publicKey,
    tokenListUnsupported,
    tokenListUnsupportedMessage,
  ]);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>代币列表</div>
      <div className={styles.balanceRow}>
        SOL 余额：{solBalance.toFixed(6)} SOL
      </div>
      {errorMessage && <div className={styles.resultRow}>{errorMessage}</div>}
      <div className={styles.actionsRow}>
        <button
          className={styles.primaryBtn}
          onClick={fetchSolBalance}
          disabled={disabled}
        >
          刷新余额
        </button>
        <button
          className={styles.primaryBtn}
          onClick={fetchTokens}
          disabled={disabled || tokenListUnsupported}
        >
          刷新代币
        </button>
      </div>
      <div className={styles.list}>
        {tokens.map((t) => (
          <div
            key={`${t.mint.toBase58()}-${t.ata.toBase58()}`}
            className={styles.listItem}
          >
            <div>代币：{t.mint.toBase58()}</div>
            <div>ATA：{t.ata.toBase58()}</div>
            <div>余额：{Number(t.amount) / Math.pow(10, t.decimals)}</div>
            <div className={styles.actionsRow}>
              <button
                className={styles.primaryBtn}
                onClick={() => onGotoTransfer?.(t.mint, t.ata)}
                disabled={disabled}
              >
                转账
              </button>
              <button
                className={styles.primaryBtn}
                onClick={() => onGotoMint?.(t.mint, publicKey!)}
                disabled={disabled}
              >
                铸币
              </button>
              <button
                className={styles.primaryBtn}
                onClick={() => onGotoMetadata?.(t.mint)}
                disabled={disabled}
              >
                设置元数据
              </button>
            </div>
          </div>
        ))}
        {tokens.length === 0 && (
          <div className={styles.empty}>暂无代币账户</div>
        )}
      </div>
    </div>
  );
}
