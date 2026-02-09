#!/bin/bash

# CloudCode Session Manager - 一键启动脚本
# 请在 macOS 终端中运行此脚本

echo "🚀 CloudCode Session Manager - 启动脚本"
echo "=========================================="
echo ""

# 第一步：修复 Xcode
echo "第一步：修复 Xcode 命令行工具..."
echo "请输入你的 Mac 密码（输入时不会显示字符）:"
sudo xcode-select --reset

if [ $? -eq 0 ]; then
    echo "✅ Xcode 已重置"
else
    echo "❌ Xcode 重置失败"
    exit 1
fi

# 验证 SDK
echo ""
echo "验证 SDK 路径..."
SDK_PATH=$(xcrun --sdk macosx --show-sdk-path)
if [ -z "$SDK_PATH" ]; then
    echo "❌ SDK 路径异常"
    exit 1
fi
echo "✅ SDK 路径正确: $SDK_PATH"

# 第二步：清除旧编译
echo ""
echo "第二步：清除旧的编译文件..."
cd /Users/mannix/Project/projectTerm/cloudcode-rust
rm -rf src-tauri/target
rm -f src-tauri/Cargo.lock
echo "✅ 旧文件已清除"

# 第三步：启动应用
echo ""
echo "第三步：启动应用（首次编译需要 30-60 秒）..."
echo "=========================================="
npm run dev

