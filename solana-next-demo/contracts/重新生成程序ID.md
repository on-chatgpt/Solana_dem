# 重新生成程序ID - 操作指南

## 步骤说明

要重新生成程序ID，需要按以下步骤操作：

### 步骤1: 删除旧的keypair文件

```bash
# 删除旧的keypair文件
rm target/deploy/my_project-keypair.json
```

### 步骤2: 生成新的keypair

```bash
# 方法1: 使用solana-keygen（推荐，但需要交互式输入）
solana-keygen new --outfile target/deploy/my_project-keypair.json --no-bip39-passphrase

# 或者方法2: 让Anchor自动生成（运行build时会自动生成）
# 直接跳到步骤3
```

### 步骤3: 构建程序（会自动生成新的keypair和程序ID）

```bash
anchor build
```

构建完成后，Anchor会：
- 自动生成新的keypair文件
- 自动更新 `declare_id!` 中的程序ID
- 自动更新 `Anchor.toml` 中的程序ID

### 步骤4: 查看新的程序ID

```bash
anchor keys list
```

### 步骤5: 部署新程序

```bash
anchor deploy
```

### 步骤6: 上传IDL

```bash
# 先关闭旧的IDL（如果存在）
anchor idl close <旧程序ID>

# 初始化新的IDL
anchor idl init --filepath target/idl/my_project.json <新程序ID>
```

## 注意事项

1. **旧程序数据会丢失**：重新部署后，旧程序的所有数据（质押池、用户质押记录等）都会丢失
2. **需要重新初始化**：部署新程序后，需要重新运行初始化脚本
3. **前端需要更新**：前端代码中的程序ID需要更新

## 快速命令（一键执行）

```bash
# 1. 删除旧keypair
rm target/deploy/my_project-keypair.json

# 2. 构建（会自动生成新的keypair和程序ID）
anchor build

# 3. 查看新程序ID
anchor keys list

# 4. 部署
anchor deploy

# 5. 初始化IDL
anchor idl init --filepath target/idl/my_project.json $(anchor keys list | grep my_project | awk '{print $2}')
```

## 如果构建时没有自动更新ID

如果 `anchor build` 后，`declare_id!` 和 `Anchor.toml` 没有自动更新，需要手动：

1. 查看新生成的程序ID：
   ```bash
   anchor keys list
   ```

2. 手动更新 `lib.rs` 中的 `declare_id!`：
   ```rust
   declare_id!("新的程序ID");
   ```

3. 手动更新 `Anchor.toml` 中的程序ID：
   ```toml
   [programs.devnet]
   my_project = "新的程序ID"
   ```

4. 重新构建：
   ```bash
   anchor build
   ```

