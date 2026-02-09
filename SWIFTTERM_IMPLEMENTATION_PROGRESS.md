# SwiftTerm 内嵌终端集成 — 实施进度文档

> 断网续做参考文档，包含所有代码和步骤。

## 总体进度

| 阶段 | 状态 | 说明 |
|------|------|------|
| Phase 1: Swift 包 + Rust FFI + build.rs | **完成** | 编译通过 |
| Phase 2: Tauri 命令 + main.rs 注册 | **完成** | 4 个命令已注册 + 退出清理 |
| Phase 3: 前端集成 | **完成** | useBackend + Dashboard + SessionDetail |

---

## 文件变更全览

### 新建文件 (4 个)

| # | 文件路径 | 用途 |
|---|----------|------|
| 1 | `src-tauri/swift/SwiftTermBridge/Package.swift` | SPM 包声明 |
| 2 | `src-tauri/swift/SwiftTermBridge/Sources/SwiftTermBridge/SwiftTermBridge.swift` | C-ABI 桥接函数 |
| 3 | `src-tauri/swift/SwiftTermBridge/Sources/SwiftTermBridge/TerminalWindowManager.swift` | NSWindow + SwiftTerm 管理单例 |
| 4 | `src-tauri/src/utils/swift_terminal.rs` | Rust FFI 声明 + 安全封装 |

### 修改文件 (5 个)

| # | 文件路径 | 变更 |
|---|----------|------|
| 5 | `src-tauri/build.rs` | 新增 `compile_swift_bridge()` |
| 6 | `src-tauri/src/utils/mod.rs` | 新增 `pub mod swift_terminal;` |
| 7 | `src-tauri/src/commands/terminal.rs` | 新增 4 个 Tauri 命令 |
| 8 | `src-tauri/src/main.rs` | 注册 4 个新命令 + 退出清理 |
| 9 | `src/hooks/useBackend.ts` | 新增 3 个 hook 函数 |

### 前端 UI (1-2 个)

| # | 文件路径 | 变更 |
|---|----------|------|
| 10 | `src/pages/ProjectDashboard.tsx` | 工具栏新增按钮 |
| 11 | `src/components/SessionDetailView.tsx` | (可选) 新增嵌入终端按钮 |

---

## Phase 1: 完整代码

### 文件 1: `src-tauri/swift/SwiftTermBridge/Package.swift`

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SwiftTermBridge",
    platforms: [.macOS(.v11)],
    products: [
        .library(
            name: "SwiftTermBridge",
            type: .static,
            targets: ["SwiftTermBridge"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/migueldeicaza/SwiftTerm", from: "2.0.0"),
    ],
    targets: [
        .target(
            name: "SwiftTermBridge",
            dependencies: ["SwiftTerm"],
            swiftSettings: [.unsafeFlags(["-parse-as-library"])]
        ),
    ]
)
```

### 文件 2: `src-tauri/swift/SwiftTermBridge/Sources/SwiftTermBridge/SwiftTermBridge.swift`

```swift
import Foundation
import AppKit
import SwiftTerm

@_cdecl("swift_open_terminal")
public func swiftOpenTerminal(
    sessionId: UnsafePointer<CChar>,
    workingDir: UnsafePointer<CChar>,
    shellPath: UnsafePointer<CChar>,
    title: UnsafePointer<CChar>
) -> Bool {
    let sid = String(cString: sessionId)
    let dir = String(cString: workingDir)
    let shell = String(cString: shellPath)
    let t = String(cString: title)

    var result = false
    if Thread.isMainThread {
        result = TerminalWindowManager.shared.openTerminal(sessionId: sid, workingDir: dir, shellPath: shell, title: t)
    } else {
        DispatchQueue.main.sync {
            result = TerminalWindowManager.shared.openTerminal(sessionId: sid, workingDir: dir, shellPath: shell, title: t)
        }
    }
    return result
}

@_cdecl("swift_close_terminal")
public func swiftCloseTerminal(sessionId: UnsafePointer<CChar>) {
    let sid = String(cString: sessionId)
    if Thread.isMainThread {
        TerminalWindowManager.shared.closeTerminal(sessionId: sid)
    } else {
        DispatchQueue.main.sync {
            TerminalWindowManager.shared.closeTerminal(sessionId: sid)
        }
    }
}

@_cdecl("swift_close_all_terminals")
public func swiftCloseAllTerminals() {
    if Thread.isMainThread {
        TerminalWindowManager.shared.closeAllTerminals()
    } else {
        DispatchQueue.main.sync {
            TerminalWindowManager.shared.closeAllTerminals()
        }
    }
}

@_cdecl("swift_is_terminal_open")
public func swiftIsTerminalOpen(sessionId: UnsafePointer<CChar>) -> Bool {
    let sid = String(cString: sessionId)
    var result = false
    if Thread.isMainThread {
        result = TerminalWindowManager.shared.isTerminalOpen(sessionId: sid)
    } else {
        DispatchQueue.main.sync {
            result = TerminalWindowManager.shared.isTerminalOpen(sessionId: sid)
        }
    }
    return result
}
```

### 文件 3: `src-tauri/swift/SwiftTermBridge/Sources/SwiftTermBridge/TerminalWindowManager.swift`

```swift
import Foundation
import AppKit
import SwiftTerm

class TerminalWindowManager: NSObject {
    static let shared = TerminalWindowManager()

    private var windows: [String: NSWindow] = [:]
    private var terminalViews: [String: LocalProcessTerminalView] = [:]

    private override init() {
        super.init()
    }

    func openTerminal(sessionId: String, workingDir: String, shellPath: String, title: String) -> Bool {
        // If already open, bring to front
        if let existingWindow = windows[sessionId] {
            existingWindow.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return true
        }

        // Create terminal view
        let terminalView = LocalProcessTerminalView(frame: NSRect(x: 0, y: 0, width: 800, height: 600))

        // Create window
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 800, height: 600),
            styleMask: [.titled, .closable, .resizable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.title = title
        window.contentView = terminalView
        window.center()
        window.isReleasedWhenClosed = false
        window.delegate = self

        // Store references
        windows[sessionId] = window
        terminalViews[sessionId] = terminalView

        // Start the shell process
        let shellArgs = ["-l"]  // login shell
        let env = ProcessInfo.processInfo.environment
        var envPairs: [String] = []
        for (key, value) in env {
            envPairs.append("\(key)=\(value)")
        }

        terminalView.startProcess(
            executable: shellPath,
            args: shellArgs,
            environment: envPairs,
            execName: (shellPath as NSString).lastPathComponent
        )

        // Set working directory by sending cd command
        let dirEscaped = workingDir.replacingOccurrences(of: "'", with: "'\\''")
        terminalView.send(txt: "cd '\(dirEscaped)' && clear\r")

        // Show window
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        return true
    }

    func closeTerminal(sessionId: String) {
        guard let window = windows[sessionId] else { return }
        window.close()
        cleanupTerminal(sessionId: sessionId)
    }

    func closeAllTerminals() {
        let sessionIds = Array(windows.keys)
        for sessionId in sessionIds {
            closeTerminal(sessionId: sessionId)
        }
    }

    func isTerminalOpen(sessionId: String) -> Bool {
        return windows[sessionId] != nil
    }

    private func cleanupTerminal(sessionId: String) {
        terminalViews.removeValue(forKey: sessionId)
        windows.removeValue(forKey: sessionId)
    }

    // Find sessionId for a given window
    private func sessionId(for window: NSWindow) -> String? {
        return windows.first(where: { $0.value === window })?.key
    }
}

extension TerminalWindowManager: NSWindowDelegate {
    func windowWillClose(_ notification: Notification) {
        guard let window = notification.object as? NSWindow,
              let sid = sessionId(for: window) else { return }
        cleanupTerminal(sessionId: sid)
    }
}
```

### 文件 4: `src-tauri/src/utils/swift_terminal.rs`

```rust
#[cfg(target_os = "macos")]
use std::ffi::CString;

#[cfg(target_os = "macos")]
extern "C" {
    fn swift_open_terminal(
        session_id: *const std::os::raw::c_char,
        working_dir: *const std::os::raw::c_char,
        shell_path: *const std::os::raw::c_char,
        title: *const std::os::raw::c_char,
    ) -> bool;

    fn swift_close_terminal(session_id: *const std::os::raw::c_char);

    fn swift_close_all_terminals();

    fn swift_is_terminal_open(session_id: *const std::os::raw::c_char) -> bool;
}

#[cfg(target_os = "macos")]
pub fn open_embedded_terminal(
    session_id: &str,
    working_dir: &str,
    shell_path: &str,
    title: &str,
) -> Result<bool, String> {
    let c_session_id = CString::new(session_id).map_err(|e| format!("Invalid session_id: {}", e))?;
    let c_working_dir = CString::new(working_dir).map_err(|e| format!("Invalid working_dir: {}", e))?;
    let c_shell_path = CString::new(shell_path).map_err(|e| format!("Invalid shell_path: {}", e))?;
    let c_title = CString::new(title).map_err(|e| format!("Invalid title: {}", e))?;

    let result = unsafe {
        swift_open_terminal(
            c_session_id.as_ptr(),
            c_working_dir.as_ptr(),
            c_shell_path.as_ptr(),
            c_title.as_ptr(),
        )
    };
    Ok(result)
}

#[cfg(target_os = "macos")]
pub fn close_embedded_terminal(session_id: &str) -> Result<(), String> {
    let c_session_id = CString::new(session_id).map_err(|e| format!("Invalid session_id: {}", e))?;
    unsafe {
        swift_close_terminal(c_session_id.as_ptr());
    }
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn close_all_embedded_terminals() {
    unsafe {
        swift_close_all_terminals();
    }
}

#[cfg(target_os = "macos")]
pub fn is_embedded_terminal_open(session_id: &str) -> Result<bool, String> {
    let c_session_id = CString::new(session_id).map_err(|e| format!("Invalid session_id: {}", e))?;
    let result = unsafe {
        swift_is_terminal_open(c_session_id.as_ptr())
    };
    Ok(result)
}
```

### 文件 5: `src-tauri/build.rs` (完整替换)

```rust
fn main() {
    // Compile Swift bridge on macOS
    #[cfg(target_os = "macos")]
    compile_swift_bridge();

    tauri_build::build()
}

#[cfg(target_os = "macos")]
fn compile_swift_bridge() {
    use std::env;
    use std::process::Command;

    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let swift_package_path = format!("{}/swift/SwiftTermBridge", manifest_dir);

    // Determine build configuration
    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());
    let swift_config = if profile == "release" { "release" } else { "debug" };

    println!("cargo:warning=Building Swift package (config: {})...", swift_config);

    // Run swift build
    let build_status = Command::new("swift")
        .args([
            "build",
            "-c", swift_config,
            "--package-path", &swift_package_path,
        ])
        .status()
        .expect("Failed to execute swift build. Is Swift installed?");

    if !build_status.success() {
        panic!("Swift build failed!");
    }

    // Get the build output directory
    let show_bin_output = Command::new("swift")
        .args([
            "build",
            "-c", swift_config,
            "--package-path", &swift_package_path,
            "--show-bin-path",
        ])
        .output()
        .expect("Failed to get swift bin path");

    let bin_path = String::from_utf8(show_bin_output.stdout)
        .expect("Invalid UTF-8 in swift bin path")
        .trim()
        .to_string();

    println!("cargo:warning=Swift build output: {}", bin_path);

    // Link the static library
    println!("cargo:rustc-link-search=native={}", bin_path);
    println!("cargo:rustc-link-lib=static=SwiftTermBridge");

    // Link Swift runtime libraries
    let swift_path_output = Command::new("xcrun")
        .args(["--toolchain", "default", "--find", "swift"])
        .output()
        .expect("Failed to find swift toolchain");
    let swift_bin = String::from_utf8(swift_path_output.stdout)
        .unwrap()
        .trim()
        .to_string();
    let toolchain_lib = std::path::Path::new(&swift_bin)
        .parent().unwrap()
        .parent().unwrap()
        .join("lib").join("swift").join("macosx");
    let toolchain_lib_str = toolchain_lib.to_str().unwrap();

    println!("cargo:rustc-link-search=native={}", toolchain_lib_str);

    let swift_compat_lib = std::path::Path::new(&swift_bin)
        .parent().unwrap()
        .parent().unwrap()
        .join("lib").join("swift_static").join("macosx");
    if swift_compat_lib.exists() {
        println!("cargo:rustc-link-search=native={}", swift_compat_lib.to_str().unwrap());
    }

    // Link macOS system frameworks
    println!("cargo:rustc-link-lib=framework=AppKit");
    println!("cargo:rustc-link-lib=framework=Foundation");
    println!("cargo:rustc-link-lib=framework=CoreGraphics");
    println!("cargo:rustc-link-lib=framework=QuartzCore");
    println!("cargo:rustc-link-lib=framework=CoreText");
    println!("cargo:rustc-link-lib=framework=CoreServices");

    // Rerun if Swift source changes
    println!("cargo:rerun-if-changed=swift/");
}
```

### 文件 6: `src-tauri/src/utils/mod.rs` (追加一行)

在现有内容末尾追加：

```rust
#[cfg(target_os = "macos")]
pub mod swift_terminal;
```

### `.gitignore` 更新

在 `src-tauri/.gitignore` 末尾追加：

```
# Swift build artifacts
swift/SwiftTermBridge/.build/
```

---

## Phase 2: Tauri 命令层 (待实现)

### 文件 7: `src-tauri/src/commands/terminal.rs` (追加 4 个命令)

在现有文件末尾追加：

```rust
#[cfg(target_os = "macos")]
use crate::utils::swift_terminal;

#[tauri::command]
pub async fn open_embedded_terminal(
    session_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    let session = state.session_service.get_session(&session_id)
        .map_err(|e| e.to_string())?;

    let project = state.project_service.get_project(&session.project_id)
        .map_err(|e| e.to_string())?;

    let shell_path = format!("/bin/{}", session.shell.to_lowercase());
    let title = format!("{} - {}", project.name, session.name);
    let working_dir = project.path.clone();

    #[cfg(target_os = "macos")]
    {
        swift_terminal::open_embedded_terminal(&session_id, &working_dir, &shell_path, &title)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Embedded terminal is only supported on macOS".to_string())
    }
}

#[tauri::command]
pub async fn close_embedded_terminal(session_id: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        swift_terminal::close_embedded_terminal(&session_id)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Embedded terminal is only supported on macOS".to_string())
    }
}

#[tauri::command]
pub async fn close_all_embedded_terminals() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        swift_terminal::close_all_embedded_terminals();
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Embedded terminal is only supported on macOS".to_string())
    }
}

#[tauri::command]
pub async fn is_embedded_terminal_open(session_id: String) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        swift_terminal::is_embedded_terminal_open(&session_id)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(false)
    }
}
```

### 文件 8: `src-tauri/src/main.rs` (修改)

1. 在 `invoke_handler` 的 `generate_handler![]` 宏里追加 4 个命令：
```rust
commands::terminal::open_embedded_terminal,
commands::terminal::close_embedded_terminal,
commands::terminal::close_all_embedded_terminals,
commands::terminal::is_embedded_terminal_open,
```

2. 在 `.run()` 之前添加退出清理：
```rust
.on_window_event(|_window, event| {
    if let tauri::WindowEvent::Destroyed = event {
        #[cfg(target_os = "macos")]
        {
            crate::utils::swift_terminal::close_all_embedded_terminals();
        }
    }
})
```

或者使用 `.setup()` hook + `on_exit`:
```rust
.setup(|app| {
    let app_handle = app.handle().clone();
    // 可选: 退出时清理
    Ok(())
})
```

---

## Phase 3: 前端集成 (待实现)

### 文件 9: `src/hooks/useBackend.ts` (追加)

在 hook 返回对象中新增 3 个函数：

```typescript
// Embedded Terminal
const openEmbeddedTerminal = useCallback(async (sessionId: string): Promise<boolean> => {
  setLoading(true);
  setError(null);
  try {
    const result = await invoke<boolean>("open_embedded_terminal", { sessionId });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setError(msg);
    return false;
  } finally {
    setLoading(false);
  }
}, []);

const closeEmbeddedTerminal = useCallback(async (sessionId: string): Promise<void> => {
  setLoading(true);
  setError(null);
  try {
    await invoke<void>("close_embedded_terminal", { sessionId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setError(msg);
  } finally {
    setLoading(false);
  }
}, []);

const isEmbeddedTerminalOpen = useCallback(async (sessionId: string): Promise<boolean> => {
  try {
    return await invoke<boolean>("is_embedded_terminal_open", { sessionId });
  } catch {
    return false;
  }
}, []);
```

在 return 中加入这三个函数。

### 文件 10: `src/pages/ProjectDashboard.tsx` (追加按钮)

在工具栏区域（靠近 "Open in Terminal" 按钮附近），新增一个 "Embedded Terminal" 按钮：

```tsx
<button
  onClick={async () => {
    if (selectedSessionId) {
      await openEmbeddedTerminal(selectedSessionId);
    }
  }}
  disabled={!selectedSessionId}
  title="Open embedded terminal window"
>
  Embedded Terminal
</button>
```

### 文件 11: `src/components/SessionDetailView.tsx` (可选)

在 Terminal Launcher 区域新增一个 "Embedded Terminal" 按钮，调用 `onOpenEmbeddedTerminal` prop。

---

## 实施顺序

```
[Phase 1] 并行执行：
  Task A: 创建 3 个 Swift 文件 (Package.swift + 2 个 .swift)
  Task B: 创建 swift_terminal.rs + 修改 utils/mod.rs

  Task C (依赖 A+B): 修改 build.rs + 更新 .gitignore
  验证: cd src-tauri && cargo build

[Phase 2] 并行执行：
  Task D: 修改 commands/terminal.rs (追加 4 个命令)
  Task E: 修改 main.rs (注册命令 + 退出清理)
  验证: cd src-tauri && cargo build

[Phase 3]:
  Task F: 修改前端 3 个文件
  验证: npm run tauri dev
```

## 注意事项

1. 首次 `swift build` 需联网下载 SwiftTerm 依赖 (~30-60s)
2. `.build/` 目录需加入 `.gitignore`
3. `LocalProcessTerminalView.startProcess()` 的 `environment` 参数格式为 `["KEY=VALUE", ...]`
4. 所有 NSWindow 操作必须在主线程 (`DispatchQueue.main.sync`)
5. `window.isReleasedWhenClosed = false` 防止窗口关闭后野指针
6. Rust `CString` 生命周期在 FFI 调用期间有效，Swift `String(cString:)` 会立即复制

## 当前已有代码位置参考

| 文件 | 行数 | 关键内容 |
|------|------|----------|
| `src-tauri/src/main.rs` | 49 行 | AppState + invoke_handler 注册 |
| `src-tauri/src/commands/terminal.rs` | 135 行 | 现有 5 个终端命令 |
| `src-tauri/src/utils/mod.rs` | 4 行 | 只有 terminal 模块 |
| `src-tauri/build.rs` | 3 行 | 只有 tauri_build::build() |
| `src/hooks/useBackend.ts` | 472 行 | 20+ 个 hook 函数 |
| `src/pages/ProjectDashboard.tsx` | 500 行 | 三栏布局 + 工具栏 |
| `src/components/SessionDetailView.tsx` | 263 行 | Session 详情面板 |
