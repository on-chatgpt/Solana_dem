"use client";
import { useEffect, useState } from "react";
import {
  WalletDisconnectButton,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";

export function WalletActions() {
  const [mounted, setMounted] = useState<boolean>(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);
  if (!mounted) return null;
  return (
    <div
      className="wallet-actions"
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 1000,
        display: "flex",
        gap: 8,
      }}
    >
      <WalletMultiButton
        style={{
          background: "#ffffff",
          color: "#000000",
          border: "1px solid #e5e7eb",
        }}
      />
      <WalletDisconnectButton
        style={{
          background: "#ffffff",
          color: "#000000",
          border: "1px solid #e5e7eb",
        }}
      />
    </div>
  );
}
