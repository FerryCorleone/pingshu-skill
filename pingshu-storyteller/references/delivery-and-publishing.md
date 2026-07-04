# 音频交付与平台上传

这份文档定义正式音频生成后的交付链路。核心原则是：音频生成和平台上传解耦。TTS 成品通过 ASR 回检后，先交付本地文件；只有用户明确需要，才进入网易云音乐云盘上传。

## 默认交付话术

正式音频完成后，Agent 应直接询问：

> 音频已生成。要不要上传到网易云音乐云盘？不需要的话我直接交付本地音频文件。

用户选择“不需要”时，给出本地音频路径、格式、时长和必要的质量备注即可。

## 交付目标

| 目标 | 用途 | 默认状态 |
| --- | --- | --- |
| `local-file` | 本地音频文件，用户可直接播放、转存或手动上传 | 默认完成态 |
| `netease-cloud` | 上传到用户自己的网易云音乐云盘，方便通勤路上在常用 App 里听 | 用户确认后启用 |
| `private-rss` | 未来可选：生成私有播客源，供通用播客 App 订阅 | 暂不内置 |
| `manual-platform-guide` | 未来可选：给小宇宙、喜马拉雅、QQ 音乐等平台的手动上传说明 | 暂不内置 |

## 网易云音乐云盘链路

当前优先接入网易云音乐官方 CLI：`@music163/ncm-cli`。它是网易云音乐 OpenClaw / Agent Skills 体系里使用的本地命令行工具，支持云盘上传、播客/声音管理、笔记等能力。

### 首次准备

下面的动作应由 Agent 主动执行和引导，不应让用户自己复制终端命令。用户只需要在打开的网页、系统输入框或网易云音乐 App 里操作。

1. Agent 检查并安装官方 CLI：

   ```bash
   npm install -g @music163/ncm-cli
   ```

2. Agent 打开 [网易云音乐开放平台](https://developer.music.163.com/st/developer/apply/account?type=INDIVIDUAL)，让用户创建应用或取得 API 凭证。

3. Agent 启动本机安全输入框，让用户填入 App ID，并选择 Private Key 文件或粘贴 Private Key 文本。

4. Agent 代跑 `ncm-cli config set appId ...` 和 `ncm-cli config set privateKey ...`。

   Private Key 优先走本地文件选择；如果只能粘贴文本，也必须通过本机隐藏输入框，不要让用户贴进聊天。Agent 不应把这些敏感信息写入任何 JSON 产物。

5. Agent 打开用户可见的登录二维码窗口：

   ```bash
   ncm-cli login
   ```

   用户用网易云音乐 App 扫码确认。扫码完成后，Agent 继续上传。

### 上传命令

优先使用当前 CLI 实际注册的命令：

```bash
ncm-cli cloudupload upload <audio_path>
```

如果 CLI 文档或旧版本不一致，可能需要回退尝试：

```bash
ncm-cli cloudupload file --file <audio_path>
ncm-cli cloudupload uploadFile --file <audio_path>
```

Skill 的上传脚本会先尝试 `cloudupload upload`；只有遇到疑似子命令不兼容时，才尝试旧命令。

### Skill 脚本

检查网易云链路：

```bash
node pingshu-storyteller/scripts/check_delivery_readiness.mjs netease-cloud
```

首次配置与登录：

```bash
node pingshu-storyteller/scripts/setup_netease_cloud.mjs <setup_manifest.json>
```

生成交付计划：

```bash
node pingshu-storyteller/scripts/create_delivery_plan.mjs <audio_path> <delivery_plan.json>
```

上传并记录 manifest：

```bash
node pingshu-storyteller/scripts/publish_netease_cloud.mjs <audio_path> <manifest.json>
```

只演练命令、不真正上传：

```bash
node pingshu-storyteller/scripts/publish_netease_cloud.mjs <audio_path> <manifest.json> --dry-run
```

## 权利边界

网易云音乐云盘上传适合“用户自己听”的私有收听场景。它不能自动等同于公开发布许可。

涉及影视剧、综艺、动漫、真人热点或二创内容时，默认只建议上传到个人云盘或本地播放。若用户要求公开发布到播客、电台、歌单、声音频道或平台推荐流，Agent 必须先提示权利、平台审核和下架风险，并让用户确认内容来源和授权状态。

不要上传：

- 未经用户确认的第三方版权音频；
- 直接克隆真实艺人或主播声音的产物；
- 从其他解说博主内容洗稿得到的音频；
- 含有未脱敏隐私信息、敏感个人数据或平台禁止内容的音频。

## 凭证处理

不要把以下信息写进 `delivery_plan.json`、上传 manifest、日志摘要或回复正文：

- app key、private key、secret；
- cookie、token、Authorization header；
- 二维码登录态；
- 用户账号的敏感个人信息。

manifest 只记录命令是否成功、命令名、退出码、脱敏后的 stdout/stderr 摘要、音频文件路径和时间戳。
