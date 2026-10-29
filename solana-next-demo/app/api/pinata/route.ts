import { NextResponse } from "next/server";
import { pinata } from "@/app/mintToken/utils/pinataSDK";
export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file: File | null = data.get("file") as File;
    const uploadData = await pinata.upload.file(file);
    const cid = uploadData.IpfsHash;
    const gatewayBase =
      process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud";
    const base = gatewayBase.replace(/\/$/, "");
    const url = `${base}/ipfs/${cid}`;
    return NextResponse.json(
      {
        url,
        ipfsHash: cid,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "no",
      },
      { status: 500 }
    );
  }
}
