"use client";
import { useState } from "react";
import styles from "../module/mintToken.module.css";

type UploadMode = "file" | "json";

interface Props {
  onImageUploaded?: (url: string, cid: string) => void;
  onJsonUploaded?: (url: string, cid: string) => void;
}

export default function IpfsTool({ onImageUploaded, onJsonUploaded }: Props) {
  const [uploadMode, setUploadMode] = useState<UploadMode>("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jsonContent, setJsonContent] = useState<string>(`{
  "name": "My Token",
  "symbol": "MTK",
  "description": "Demo metadata",
  "image": "<填入图片网关URL或 ipfs://CID>",
  "attributes":[{
  "trait_type":"属性名称",
  "value":"属性值"
  }]
}`);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageCid, setImageCid] = useState<string>("");
  const [jsonUrl, setJsonUrl] = useState<string>("");
  const [jsonCid, setJsonCid] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setSelectedFile(f);
  };

  const handleUpload = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      if (uploadMode === "file" && selectedFile) {
        formData.append("file", selectedFile);
      } else if (uploadMode === "json") {
        const blob = new Blob([jsonContent], { type: "application/json" });
        const jsonFile = new File([blob], "metadata.json", {
          type: "application/json",
        });
        formData.append("file", jsonFile);
      } else {
        throw new Error("请先选择文件或编写 JSON 内容");
      }

      const response = await fetch("/api/pinata", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      const url: string = data?.url || "";
      const cid: string = data?.ipfsHash || "";
      if (uploadMode === "file") {
        setImageUrl(url);
        setImageCid(cid);
        onImageUploaded?.(url, cid);
      } else {
        setJsonUrl(url);
        setJsonCid(cid);
        onJsonUploaded?.(url, cid);
      }
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>IPFS 上传（Pinata）</div>

      <div className={styles.actionsRow}>
        <button
          className={styles.primaryBtn}
          onClick={() => setUploadMode("file")}
          disabled={loading}
        >
          上传图片文件
        </button>
        <button
          className={styles.primaryBtn}
          onClick={() => setUploadMode("json")}
          disabled={loading}
        >
          上传 JSON 元数据
        </button>
      </div>

      {uploadMode === "file" && (
        <div className={styles.formRow}>
          <input
            className={styles.input}
            type="file"
            onChange={handleFileChange}
          />
        </div>
      )}

      {uploadMode === "json" && (
        <div className={styles.formRow}>
          <textarea
            className={styles.input}
            rows={10}
            value={jsonContent}
            onChange={(e) => setJsonContent(e.target.value)}
          />
        </div>
      )}

      <div className={styles.actionsRow}>
        <button
          className={styles.primaryBtn}
          onClick={handleUpload}
          disabled={loading}
        >
          {loading ? "上传中..." : "开始上传"}
        </button>
      </div>

      <div className={styles.resultRow}>
        图片网关：{imageUrl || "--"}{" "}
        {imageUrl && (
          <button className={styles.primaryBtn} onClick={() => copy(imageUrl)}>
            复制
          </button>
        )}
      </div>
      <div className={styles.resultRow}>
        图片 CID：{imageCid || "--"}{" "}
        {imageCid && (
          <button
            className={styles.primaryBtn}
            onClick={() => copy(`ipfs://${imageCid}`)}
          >
            复制
          </button>
        )}
      </div>

      <div className={styles.resultRow}>
        JSON 网关：{jsonUrl || "--"}{" "}
        {jsonUrl && (
          <button className={styles.primaryBtn} onClick={() => copy(jsonUrl)}>
            复制
          </button>
        )}
      </div>
      <div className={styles.resultRow}>
        JSON CID：{jsonCid || "--"}{" "}
        {jsonCid && (
          <button
            className={styles.primaryBtn}
            onClick={() => copy(`ipfs://${jsonCid}`)}
          >
            复制
          </button>
        )}
      </div>
    </div>
  );
}
