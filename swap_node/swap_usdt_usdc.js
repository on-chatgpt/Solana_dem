const fs = require("fs");
const path = require("path");
const {
  Connection,
  Keypair,
  VersionedTransaction,
  clusterApiUrl,
} = require("@solana/web3.js");

// 主网 USDT / USDC 的 mint 地址（固定）
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FY64MxTjLr2WkTbncX4p6xE";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
// USDT 小数位（主网 SPL USDT 为 6 位）
const USDT_DECIMALS = 6;

function parseArgs() {
  // 解析命令行参数，支持：
  // --keypair wallets/w1.json
  // --amount 2
  // --slippage 0.5
  const args = process.argv.slice(2);
  const out = {
    keypair: null,
    amount: 2,
    slippage: 0.5,
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--keypair" && args[i + 1]) out.keypair = args[i + 1];
    if (arg === "--amount" && args[i + 1]) out.amount = Number(args[i + 1]);
    if (arg === "--slippage" && args[i + 1]) out.slippage = Number(args[i + 1]);
  }
  return out;
}

function resolveDefaultKeypair() {
  // 未指定 --keypair 时，自动在 wallets/ 下寻找唯一的 .json 私钥文件
  const walletsDir = path.join(process.cwd(), "wallets");
  if (!fs.existsSync(walletsDir)) {
    throw new Error("wallets directory not found");
  }
  const files = fs
    .readdirSync(walletsDir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  if (files.length === 0) {
    throw new Error("No .json keypair found in wallets directory");
  }
  if (files.length > 1) {
    throw new Error(
      `Multiple keypairs found in wallets/. Please specify --keypair. Found: ${files.join(", ")}`
    );
  }
  return path.join("wallets", files[0]);
}

function loadKeypair(filePath) {
  // 读取 solana-keygen new --outfile 生成的 JSON 数组私钥
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
  const secret = JSON.parse(fs.readFileSync(absolute, "utf8"));
  const secretKey = Uint8Array.from(secret);
  return Keypair.fromSecretKey(secretKey);
}

async function main() {
  const { keypair, amount, slippage } = parseArgs();
  // 基础参数校验
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount must be a positive number");
  }
  if (!Number.isFinite(slippage) || slippage <= 0) {
    throw new Error("slippage must be a positive number, e.g. 0.5");
  }

  // 选择 keypair：命令行指定优先，否则自动找 wallets/ 下唯一文件
  const keypairPath = keypair || resolveDefaultKeypair();
  const payer = loadKeypair(keypairPath);
  // 连接主网
  const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

  // 把 2 USDT 这样的输入金额换算成最小单位（整数）
  const amountInBaseUnits = Math.round(amount * 10 ** USDT_DECIMALS);
  // 0.5% -> 50 bps
  const slippageBps = Math.round(slippage * 100);

  // 调用 Jupiter Quote API 获取最优路径
  const quoteUrl = new URL("https://quote-api.jup.ag/v6/quote");
  quoteUrl.searchParams.set("inputMint", USDT_MINT);
  quoteUrl.searchParams.set("outputMint", USDC_MINT);
  quoteUrl.searchParams.set("amount", String(amountInBaseUnits));
  quoteUrl.searchParams.set("slippageBps", String(slippageBps));
  quoteUrl.searchParams.set("swapMode", "ExactIn");

  console.log("Fetching quote...");
  const quoteRes = await fetch(quoteUrl.toString());
  if (!quoteRes.ok) {
    throw new Error(`Quote request failed: ${quoteRes.status} ${quoteRes.statusText}`);
  }
  const quoteJson = await quoteRes.json();
  if (!quoteJson || !quoteJson.routePlan || quoteJson.routePlan.length === 0) {
    throw new Error("No route found from Jupiter");
  }

  // 请求 Jupiter 生成可直接签名发送的交易
  const swapRes = await fetch("https://quote-api.jup.ag/v6/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quoteJson,
      userPublicKey: payer.publicKey.toBase58(),
      // 允许自动包裹/解包 SOL（此处主要用于路由可能需要 SOL 作为临时中转）
      wrapAndUnwrapSol: true,
      // 动态调整计算预算，减少交易失败率
      dynamicComputeUnitLimit: true,
      // 让 Jupiter 自动估算优先费
      prioritizationFeeLamports: "auto",
    }),
  });
  if (!swapRes.ok) {
    throw new Error(`Swap request failed: ${swapRes.status} ${swapRes.statusText}`);
  }
  const swapJson = await swapRes.json();
  if (!swapJson.swapTransaction) {
    throw new Error("Missing swapTransaction in Jupiter response");
  }

  // 反序列化交易、用本地 keypair 签名
  const tx = VersionedTransaction.deserialize(
    Buffer.from(swapJson.swapTransaction, "base64")
  );
  tx.sign([payer]);

  // 发送交易到主网
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  console.log("Signature:", signature);

  // 等待确认
  const confirmation = await connection.confirmTransaction(signature, "confirmed");
  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }
  console.log("Swap confirmed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
