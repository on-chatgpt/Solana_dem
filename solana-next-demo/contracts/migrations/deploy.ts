import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MyProject } from "../target/types/my_project";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createInitializeAccountInstruction,
  getAccount,
  AccountLayout,
} from "@solana/spl-token";
import * as fs from "fs";

/**
 * 部署脚本说明：
 *
 * 这个脚本会：
 * 1. 连接到Solana开发网络（devnet）
 * 2. 创建两个代币账户：
 *    - stake_token_account: 存储用户质押的HHF代币
 *    - interest_token_account: 存储用于支付利息的HHF代币
 * 3. 将这两个代币账户的authority设置为stake_pool PDA
 * 4. 初始化质押池
 * 5. （可选）向利息池账户存入一些HHF代币用于支付利息
 *
 * 使用前准备：
 * 1. 确保已经部署了程序：anchor build && anchor deploy
 * 2. 确保你的钱包有足够的SOL（用于支付交易费用）
 * 3. 确保你有HHF代币的mint地址
 * 4. 确保你的钱包中有一些HHF代币（用于存入利息池）
 */

async function main() {
  // 连接到Solana网络
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // 加载钱包（默认使用 ~/.config/solana/id.json）
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8"))));
  const wallet = new anchor.Wallet(walletKeypair);

  console.log("钱包地址:", wallet.publicKey.toString());

  // 加载程序
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = anchor.workspace.MyProject as Program<MyProject>;
  console.log("程序ID:", program.programId.toString());

  // ========== 配置参数 ==========
  // 请替换为你的HHF代币mint地址
  const HHF_TOKEN_MINT = new PublicKey("CUBCxykvZF3iMKdKQMfXow87YKqAc7RB58mbckF8pG2t");

  // 如果要向利息池存入代币，设置这个数量（可选）
  const INTEREST_POOL_DEPOSIT_AMOUNT = 1000000; // 例如：1000000个代币（根据你的代币精度调整）

  // ========== 1. 计算PDA地址 ==========
  const [stakePoolPda] = PublicKey.findProgramAddressSync([Buffer.from("stake_pool")], program.programId);
  console.log("\n质押池PDA地址:", stakePoolPda.toString());

  // ========== 2. 创建代币账户 ==========
  console.log("\n========== 创建代币账户 ==========");

  // 2.1 创建质押代币账户（存储用户质押的代币）
  // 这个账户的authority是stake_pool PDA
  const stakeTokenAccount = await getAssociatedTokenAddress(
    HHF_TOKEN_MINT,
    stakePoolPda,
    true // allowOwnerOffCurve: true，因为authority是PDA
  );
  console.log("质押代币账户地址:", stakeTokenAccount.toString());

  // 检查账户是否已存在
  try {
    await getAccount(connection, stakeTokenAccount);
    console.log("质押代币账户已存在");
  } catch (e) {
    console.log("创建质押代币账户...");
    // 创建关联代币账户
    const createStakeTokenAccountIx = await createAssociatedTokenAccountInstruction(
      wallet.publicKey, // payer
      stakeTokenAccount, // associatedToken
      stakePoolPda, // owner (PDA)
      HHF_TOKEN_MINT // mint
    );

    const tx = new Transaction().add(createStakeTokenAccountIx);
    await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    console.log("质押代币账户创建成功");
  }

  // 2.2 创建利息池代币账户（用于支付利息）
  // 注意：由于使用相同的mint和owner（stake_pool PDA），interestTokenAccount和stakeTokenAccount是同一个账户
  // 这是可以接受的，因为：
  // 1. 所有代币都在同一个账户中
  // 2. 程序通过逻辑区分质押本金和利息资金
  // 3. 管理员需要确保账户中有足够的代币来支付利息
  //
  // 如果你想要两个独立的账户，可以：
  // - 使用不同的seed创建两个不同的PDA作为owner
  // - 或者让利息池账户的owner是管理员（但这样需要管理员签名来支付利息）
  const interestTokenAccount = await getAssociatedTokenAddress(
    HHF_TOKEN_MINT,
    stakePoolPda,
    true // allowOwnerOffCurve: true
  );
  console.log("利息池代币账户地址:", interestTokenAccount.toString());

  // 检查两个账户是否是同一个
  if (stakeTokenAccount.equals(interestTokenAccount)) {
    console.log("注意：质押代币账户和利息池代币账户是同一个账户（因为它们有相同的mint和owner）");
    console.log("这是可以接受的，程序通过逻辑来区分质押本金和利息资金");
    console.log("请确保向这个账户存入足够的HHF代币用于支付利息");
  } else {
    // 如果账户不同，检查利息池账户是否存在
    try {
      await getAccount(connection, interestTokenAccount);
      console.log("利息池代币账户已存在");
    } catch (e) {
      console.log("创建利息池代币账户...");
      const createInterestTokenAccountIx = await createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        interestTokenAccount, // associatedToken
        stakePoolPda, // owner (PDA)
        HHF_TOKEN_MINT // mint
      );

      const tx = new Transaction().add(createInterestTokenAccountIx);
      await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
      console.log("利息池代币账户创建成功");
    }
  }

  // ========== 3. 初始化质押池 ==========
  console.log("\n========== 初始化质押池 ==========");

  try {
    // 检查质押池是否已初始化
    // 注意：需要先运行 anchor build 来生成类型定义
    const stakePoolAccount = await (program.account as any).stakePool.fetch(stakePoolPda);
    console.log("质押池已存在，跳过初始化");
    console.log("当前总质押量:", stakePoolAccount.totalStaked.toString());
  } catch (e) {
    console.log("初始化质押池...");

    const tx = await (program.methods as any)
      .initialize(HHF_TOKEN_MINT)
      .accounts({
        authority: wallet.publicKey,
        stakePool: stakePoolPda,
        interestTokenAccount: interestTokenAccount,
        stakeTokenAccount: stakeTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("质押池初始化成功！");
    console.log("交易签名:", tx);

    // 验证初始化
    const stakePoolAccount = await (program.account as any).stakePool.fetch(stakePoolPda);
    console.log("质押池信息:");
    console.log("  - 管理员:", stakePoolAccount.authority.toString());
    console.log("  - 代币Mint:", stakePoolAccount.tokenMint.toString());
    console.log("  - 利息池账户:", stakePoolAccount.interestTokenAccount.toString());
    console.log("  - 质押代币账户:", stakePoolAccount.stakeTokenAccount.toString());
    console.log("  - 总质押量:", stakePoolAccount.totalStaked.toString());
  }

  // ========== 4. （可选）向利息池存入代币 ==========
  if (INTEREST_POOL_DEPOSIT_AMOUNT > 0) {
    console.log("\n========== 向利息池存入代币 ==========");

    // 获取用户的HHF代币账户
    const userTokenAccount = await getAssociatedTokenAddress(HHF_TOKEN_MINT, wallet.publicKey);

    // 检查用户是否有足够的代币
    try {
      const userTokenAccountInfo = await getAccount(connection, userTokenAccount);
      console.log("用户代币余额:", userTokenAccountInfo.amount.toString());

      if (userTokenAccountInfo.amount < BigInt(INTEREST_POOL_DEPOSIT_AMOUNT)) {
        console.log("警告：用户代币余额不足，无法存入利息池");
        console.log("请确保你的钱包中有足够的HHF代币");
      } else {
        // 转移代币到利息池账户
        // 注意：这里需要从用户的代币账户转移到利息池账户
        // 由于利息池账户的authority是PDA，我们需要使用程序来转移
        // 或者，你可以先转移到你自己的账户，然后通过程序转移

        console.log("注意：向利息池存入代币需要额外的转账操作");
        console.log("你可以手动将HHF代币转移到利息池账户，或者创建一个管理函数来处理");
        console.log("利息池账户地址:", interestTokenAccount.toString());
      }
    } catch (e) {
      console.log("用户代币账户不存在或无法访问");
      console.log("请确保你已经创建了HHF代币账户并持有代币");
    }
  }

  console.log("\n========== 部署完成 ==========");
  console.log("\n重要信息：");
  console.log("1. 质押池PDA地址:", stakePoolPda.toString());
  console.log("2. 质押代币账户:", stakeTokenAccount.toString());
  console.log("3. 利息池代币账户:", interestTokenAccount.toString());
  console.log("4. HHF代币Mint:", HHF_TOKEN_MINT.toString());
  console.log("\n下一步：");
  console.log("1. 确保利息池账户中有足够的HHF代币用于支付利息");
  console.log("2. 在前端或测试脚本中调用stake、claimInterest、claimAll函数");
}

main()
  .then(() => {
    console.log("脚本执行完成");
    process.exit(0);
  })
  .catch(error => {
    console.error("错误:", error);
    process.exit(1);
  });
