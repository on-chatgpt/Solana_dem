require("dotenv").config();
const { URL } = require("url");

const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_DECIMALS = 6;

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    inputMint: USDT_MINT,
    outputMint: USDC_MINT,
    decimals: USDT_DECIMALS,
    amount: 2,
    slippage: 0.5,
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--inputMint" && args[i + 1]) out.inputMint = args[i + 1];
    if (arg === "--outputMint" && args[i + 1]) out.outputMint = args[i + 1];
    if (arg === "--decimals" && args[i + 1]) out.decimals = Number(args[i + 1]);
    if (arg === "--amount" && args[i + 1]) out.amount = Number(args[i + 1]);
    if (arg === "--slippage" && args[i + 1]) out.slippage = Number(args[i + 1]);
  }
  return out;
}

function summarizeRoute(quoteJson, inputDecimals, outputDecimals) {
  const {
    inputMint,
    outputMint,
    inAmount,
    outAmount,
    otherAmountThreshold,
  } = quoteJson;
  const routePlan = quoteJson.routePlan || [];
  return {
    inputMint,
    outputMint,
    inAmount,
    outAmount,
    otherAmountThreshold,
    inAmountUi: Number(inAmount) / 10 ** inputDecimals,
    outAmountUi: Number(outAmount) / 10 ** outputDecimals,
    minOutUi: Number(otherAmountThreshold) / 10 ** outputDecimals,
    hops: routePlan.length,
    steps: routePlan.map((step, index) => {
      const swap = step.swapInfo || {};
      return {
        index,
        label: swap.label || "unknown",
        inAmount: swap.inAmount,
        outAmount: swap.outAmount,
        feeAmount: swap.feeAmount,
        feeMint: swap.feeMint,
      };
    }),
  };
}

async function main() {
  const { inputMint, outputMint, decimals, amount, slippage } = parseArgs();
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount must be a positive number");
  }
  if (!Number.isFinite(decimals) || decimals < 0) {
    throw new Error("decimals must be a non-negative number");
  }
  if (!Number.isFinite(slippage) || slippage <= 0) {
    throw new Error("slippage must be a positive number, e.g. 0.5");
  }

  const amountInBaseUnits = Math.round(amount * 10 ** decimals);
  const slippageBps = Math.round(slippage * 100);

  const apiKey = process.env.JUP_API_KEY || "";
  const baseUrl =
    process.env.JUP_API_BASE ||
    (apiKey ? "https://api.jup.ag" : "https://lite-api.jup.ag");
  const quoteUrl = new URL("/swap/v1/quote", baseUrl);
  quoteUrl.searchParams.set("inputMint", inputMint);
  quoteUrl.searchParams.set("outputMint", outputMint);
  quoteUrl.searchParams.set("amount", String(amountInBaseUnits));
  quoteUrl.searchParams.set("slippageBps", String(slippageBps));
  quoteUrl.searchParams.set("swapMode", "ExactIn");
  quoteUrl.searchParams.set("restrictIntermediateTokens", "true");

  console.log("Fetching quote route...\n");
  console.log("URL:", quoteUrl.toString(), "\n");
  const headers = apiKey ? { "x-api-key": apiKey } : undefined;
  const quoteRes = await fetch(quoteUrl.toString(), { headers });
  if (!quoteRes.ok) {
    const errBody = await quoteRes.text();
    throw new Error(
      `Quote request failed: ${quoteRes.status} ${quoteRes.statusText}\n${errBody}`
    );
  }
  const quoteJson = await quoteRes.json();
  if (!quoteJson || !quoteJson.routePlan || quoteJson.routePlan.length === 0) {
    throw new Error("No route found from Jupiter");
  }

  const summary = summarizeRoute(quoteJson, decimals, 6);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
