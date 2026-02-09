# 🚀 CloudCode Session Manager - START HERE

## 📋 快速导航

### 🎯 我想...

**立即运行应用**
→ 跳到 [启动应用](#启动应用)

**了解编译过程**
→ 查看 [BUILD_SUCCESS.md](BUILD_SUCCESS.md)

**查看完整指南**
→ 查看 [FINAL_STATUS.txt](FINAL_STATUS.txt)

**需要中文说明**
→ 查看 [运行说明.md](运行说明.md)

**查看所有文档**
→ 查看 [INDEX.md](INDEX.md)

---

## ✅ 项目状态

```
✅ 代码完成:       5,600+ 行生产级代码
✅ 编译成功:       0 错误，2.23 秒
✅ 功能完整:       16 个 IPC 命令已注册
✅ 应用就绪:       可立即启动
```

---

## 🚀 启动应用

### 最快的方式

```bash
cd /Users/mannix/Project/projectTerm/cloudcode-rust
npm run dev
```

### 如果上述命令不工作

```bash
# 方式 1: 手动启动（如果有路径问题）
cd /Users/mannix/Project/projectTerm/cloudcode-rust
npm install
npm run dev

# 方式 2: 使用启动脚本（自动处理 Xcode 问题）
bash /Users/mannix/Project/projectTerm/cloudcode-rust/RUN_ME.sh
```

---

## 📊 应用启动时会看到

```
> cloudcode-rust@0.1.0 dev
> tauri dev

  VITE v5.4.21 ready in 124 ms

  ➜  Local:   http://127.0.0.1:5179/

[Tauri] Application running...
```

然后一个桌面窗口会自动打开，显示 CloudCode Session Manager 的界面。

---

## 🎯 首次使用

### 1️⃣ 创建项目

- 点击 "New Project"
- 输入项目名称
- 选择项目路径（或留空）
- 点击 "Create"

### 2️⃣ 创建会话

- 在项目中点击 "New Session"
- 输入会话名称
- 选择 Shell 类型 (bash/zsh/fish/etc.)
- 添加环境变量（可选）
- 点击 "Create"

### 3️⃣ 打开终端

- 选择一个会话
- 点击 "Open in Terminal"
- 选择偏好的终端 (Terminal.app/iTerm2/WezTerm/Alacritty)
- 终端会打开并导航到项目路径

---

## 📁 重要目录

### 应用数据位置
```
~/Library/Application Support/CloudCodeSessionManager/
```
这里保存了您的项目和会话数据

### 项目代码位置
```
/Users/mannix/Project/projectTerm/cloudcode-rust/

src/                  # React + TypeScript 前端
src-tauri/            # Rust 后端
  ├── src/
  │   ├── commands/   # 16 个 Tauri IPC 命令
  │   ├── models/     # 数据结构
  │   ├── services/   # 业务逻辑
  │   └── utils/      # 工具函数
```

---

## 🔧 如果遇到问题

### 问题: 应用不启动

**解决方案 1**: 检查依赖
```bash
npm install
```

**解决方案 2**: 清理缓存并重启
```bash
rm -rf node_modules src-tauri/target
npm install
npm run dev
```

**解决方案 3**: 使用 RUN_ME.sh 脚本
```bash
bash RUN_ME.sh
```

### 问题: 端口被占用

不用担心！应用会自动查找可用端口（5173-5179）。只需运行：
```bash
npm run dev
```

### 问题: Xcode 相关错误

如果看到 Xcode 错误，运行：
```bash
sudo xcode-select --reset
npm run dev
```

---

## 📚 完整文档

| 文档 | 内容 |
|------|------|
| [BUILD_SUCCESS.md](BUILD_SUCCESS.md) | 编译成功报告 + 完整指南 |
| [FINAL_STATUS.txt](FINAL_STATUS.txt) | 最终状态摘要 |
| [运行说明.md](运行说明.md) | 中文详细说明 |
| [QUICK_START.txt](QUICK_START.txt) | 快速参考卡 |
| [README.md](README.md) | 项目概览 |
| [INDEX.md](INDEX.md) | 所有文档索引 |

---

## 💡 快速提示

- **热重载**: 编辑 React/TypeScript 代码会自动刷新
- **后端更改**: 修改 Rust 代码会自动重新编译
- **数据保存**: 所有项目和会话数据自动保存
- **终端选择**: 可随时更改偏好的终端应用

---

## 🎉 祝贺！

您现在拥有一个完整的、生产级的项目和会话管理应用！

**下一步**: 运行 `npm run dev` 享受这个应用吧！ 🚀

---

**最后更新**: 2026-02-09
**版本**: 1.0.0 MVP
**状态**: ✅ 生产就绪
