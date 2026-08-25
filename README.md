# 英语作文批改工具

纯前端 + 火山方舟 API 调用，专为初中英语老师批改手写作文设计。

## 功能

- 📷 上传 / 粘贴学生手写作文图片（左侧可缩放、平移）
- 🔤 调用视觉模型 OCR，识别为英文文本
- ✏️ **OCR 后允许手动校对** 再进入批改
- 📝 可选填作文题目（不填也行）
- 🎯 调用 DeepSeek 系列模型批改，**严格限定初中范围词汇与语法**
- 🔴 **Word 修订模式**红字批注（删除线 + 红色插入）
- 💬 鼠标悬浮红字段，显示中文修改理由
- 📊 50 分制评分（内容 20 + 语言 20 + 结构 10）+ 总评

## 安装与运行

```bash
npm install
npm run dev          # 开发模式（默认 http://localhost:5173）
npm run build        # 构建静态文件到 dist/
npm run preview      # 预览构建产物
```

构建后的 `dist/` 是纯静态文件，可双击 `index.html` 直接用，也可放到任意静态服务器。

## 首次使用：配置火山方舟接入点

打开应用后右上角 **⚙ 设置** 弹窗，填入以下三项（保存在浏览器 localStorage，不上传任何服务器）：

| 字段 | 说明 |
|---|---|
| **API Key** | 你的火山方舟 API Key（形如 `ark-xxxx...`） |
| **视觉模型接入点 ID** | 用于 OCR，建议选 Doubao-1.5-vision-pro |
| **批改模型接入点 ID** | 用于批改，建议选 DeepSeek-V3.1 或更新版本 |

### 如何创建接入点

1. 登录 [火山方舟控制台](https://console.volcengine.com/ark)
2. 左侧菜单 → **在线推理** → **创建推理接入点**
3. **创建第一个**：选 `Doubao-1.5-vision-pro`（或同系列视觉模型），命名 `essay-ocr`，复制生成的 `ep-xxxxxxx` ID
4. **创建第二个**：选 `DeepSeek-V3.1`（或更高版本），命名 `essay-grade`，复制 `ep-xxxxxxx` ID
5. 把两个 ID 填入设置面板对应字段

> 💡 **关于"DeepSeek Pro V4"**：如火山方舟模型广场已上线该版本，请直接选最新版本接入即可，本工具不依赖具体型号。

## 使用流程

1. 左侧上传作文图片（或 Ctrl+V 粘贴）
2. 右侧点击 **「开始识别」** → 等待 OCR 完成
3. 在右侧文本框中**校对**识别结果，可选填作文题目
4. 点击 **「校对完成，开始批改」** → 等待批改完成
5. 查看红字批注（鼠标悬浮可见修改理由）+ 分数 + 总评

## 技术栈

- Vue 3 + Vite
- diff-match-patch（生成 word-level diff）
- 直接 fetch 调用火山方舟 OpenAI 兼容协议（`/api/v3/chat/completions`）

## 项目结构

```
src/
├── App.vue                      主布局 & 流程控制
├── main.js                      入口
├── style.css                    全局样式
├── config.js                    配置存取（localStorage）
├── prompts.js                   OCR + 批改 Prompt
├── api.js                       火山方舟 API 调用封装
├── diff.js                      Word-level diff 工具
└── components/
    ├── ImageViewer.vue          左侧：图片上传 + 缩放平移
    ├── RightPanel.vue           右侧：校对 / 批改结果
    └── SettingsDialog.vue       设置弹窗
```

## 已知限制

- 手写体 OCR 准确率取决于字迹清晰度，潦草字迹建议人工校对修正后再批改。
- API Key 暴露在前端是有意为之（仅自己用），切勿部署到公网共享。
- 批改结果由模型生成，仅供参考，最终评分以教师判断为准。

## 后续可扩展

- 历史记录（IndexedDB）
- 导出 PDF / 图片
- 批量批改
- 自定义提示词模板
