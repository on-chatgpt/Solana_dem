import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  getCreateMetadataAccountV3InstructionDataSerializer,
  getUpdateMetadataAccountV2InstructionDataSerializer,
} from "@metaplex-foundation/mpl-token-metadata";

const METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export function deriveMetadataPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID
  );
  return pda;
}

export async function hasMetadata(
  connection: Connection,
  mint: PublicKey
): Promise<boolean> {
  const pda = deriveMetadataPda(mint);
  const info = await connection.getAccountInfo(pda);
  return !!info;
}

export async function createMetadata(
  connection: Connection,
  wallet: WalletContextState,
  mint: PublicKey,
  name: string,
  symbol: string,
  uri: string
): Promise<string> {
  if (!wallet.publicKey) throw new Error("钱包未连接");
  const metadataPda = deriveMetadataPda(mint);
  const data = getCreateMetadataAccountV3InstructionDataSerializer().serialize({
    data: {
      name,
      symbol,
      uri,
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
    },
    isMutable: true,
    collectionDetails: null,
  });
  const keys = [
    { pubkey: metadataPda, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // mintAuthority
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // payer
    { pubkey: wallet.publicKey, isSigner: false, isWritable: false }, // updateAuthority
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];
  const ix = new TransactionInstruction({
    keys,
    programId: METADATA_PROGRAM_ID,
    data: Buffer.from(data),
  });
  const tx = new Transaction().add(ix);
  const sig = await wallet.sendTransaction(tx, connection);
  return sig;
}

export async function updateMetadata(
  connection: Connection,
  wallet: WalletContextState,
  mint: PublicKey,
  name: string,
  symbol: string,
  uri: string
): Promise<string> {
  if (!wallet.publicKey) throw new Error("钱包未连接");
  const metadataPda = deriveMetadataPda(mint);
  const data = getUpdateMetadataAccountV2InstructionDataSerializer().serialize({
    data: {
      name,
      symbol,
      uri,
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
    },
    newUpdateAuthority: null,
    primarySaleHappened: null,
    isMutable: true,
  });
  const keys = [
    { pubkey: metadataPda, isSigner: false, isWritable: true },
    { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // updateAuthority
  ];
  const ix = new TransactionInstruction({
    keys,
    programId: METADATA_PROGRAM_ID,
    data: Buffer.from(data),
  });
  const tx = new Transaction().add(ix);
  const sig = await wallet.sendTransaction(tx, connection);
  return sig;
}
