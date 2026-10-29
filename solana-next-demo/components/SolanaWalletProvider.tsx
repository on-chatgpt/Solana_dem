"use client"; // Next.js 客户端组件：钱包交互需要在客户端运行
import type { ReactNode } from "react";
import { createContext, useMemo } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import type { WalletAdapter } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css"; // 钱包 UI 的基础样式
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

type ClusterName = "devnet" | "testnet" | "mainnet-beta";
const CLUSTER: ClusterName =
  (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as ClusterName) || "devnet";
const SOLANA_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(CLUSTER);
export const SolanaEndpointContext = createContext<string>(SOLANA_ENDPOINT);

export default function SolanaWalletProvider({
  children,
}: {
  children: ReactNode;
}) {
  const endpoint = SOLANA_ENDPOINT;
  const walletIds = useMemo(
    () =>
      (process.env.NEXT_PUBLIC_WALLETS || "phantom,solflare")
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    []
  );
  const wallets = useMemo<WalletAdapter[]>(() => {
    const list: WalletAdapter[] = [];
    if (walletIds.includes("phantom")) list.push(new PhantomWalletAdapter());
    if (walletIds.includes("solflare")) list.push(new SolflareWalletAdapter());
    return list;
  }, [walletIds]);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <SolanaEndpointContext.Provider value={endpoint}>
            {children}
          </SolanaEndpointContext.Provider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
