export type AppLanguage = "zh-CN" | "en-US";

export type TranslationParams = Record<string, string | number>;

export const DEFAULT_APP_LANGUAGE: AppLanguage = "zh-CN";

const dictionaries = {
  "zh-CN": {
    confirm_delete_session: "删除此会话？此操作不可撤销。",
    confirm_delete_project: "从侧边栏删除项目“{name}”？",
    status_ready: "已就绪。",
    status_load_failed: "加载项目/会话失败。",
    status_project_create_cancelled: "已取消添加项目。",
    status_project_added: "已添加项目：{name}",
    status_project_create_failed: "添加项目失败：{message}",
    status_session_deleted: "会话已删除。",
    status_session_delete_failed: "删除会话失败。",
    status_stop_terminal_failed: "停止会话终端失败。",
    status_opened_in_app: "已在 {app} 中打开。",
    status_open_terminal_failed: "外部终端打开失败。",
    status_open_editor_failed: "编辑器打开失败。",
    status_project_removed: "已移除项目：{name}",
    status_project_delete_failed: "删除项目失败。",
    status_session_renamed: "会话已重命名：{name}",
    status_session_rename_fallback: "原生重命名不可用，已保存为本地别名。",
    status_settings_load_failed: "读取配置失败，已使用当前内存设置。",
    status_settings_save_failed: "保存配置失败。",
    status_reload_settings: "已重新加载配置文件。",
    status_terminal_write_failed: "终端写入失败，请重试或重开会话。",
    status_terminal_start_failed: "终端启动失败：{message}",
    status_unexpected_error: "发生未处理错误，请查看日志。",
    title_show_sidebar: "展开侧边栏  ⌘B",
    title_hide_sidebar: "收起侧边栏  ⌘B",
    title_switch_to_light: "切换浅色",
    title_switch_to_dark: "切换深色",
    title_add_project: "添加项目",
    title_settings_shortcut: "设置  ⌘,",
    title_remove_project_sidebar: "从侧边栏移除此项目",
    title_quick_new_session: "快速新建 Claude 会话",
    title_session_actions: "会话操作",
    title_drag_resize_sidebar: "拖动调整侧边栏宽度",
    settings_title: "设置",
    aria_close_settings: "关闭设置",
    nav_claude: "Claude",
    nav_appearance: "外观",
    nav_integrations: "集成",
    section_language: "语言",
    language_zh_cn: "中文",
    language_en_us: "English",
    section_theme_mode: "主题模式",
    theme_light: "浅色",
    theme_dark: "深色",
    theme_system: "跟随系统",
    hint_theme_palette:
      "主题色板存储在 preferences.json 中，可直接编辑以支持 AI 驱动的自定义主题。",
    section_external_terminal: "外部终端",
    section_external_editor: "外部编辑器",
    hint_integrations:
      "会话菜单中的“终端打开项目 / 编辑器打开项目”将使用此默认配置，所有值都写入 preferences.json。",
    section_claude_startup: "Claude 启动参数",
    label_enable_custom_args: "启用自定义 Claude 启动参数",
    hint_claude_startup:
      "关闭时使用默认 `claude --resume`。开启后默认参数为 `--dangerously-skip-permissions`，并应用于会话恢复与快速新建会话。",
    section_session_restore: "会话恢复",
    label_restore_last_session: "启动时恢复上次打开的会话",
    hint_restore_last_session:
      "应用启动后自动恢复上次活跃会话。关闭后将回退到“最近会话优先”的默认行为。",
    button_done: "完成",
    tree_no_sessions: "暂无会话",
    tree_no_projects: "暂无项目",
    menu_edit_session_name: "编辑会话名",
    menu_open_project_terminal: "终端打开项目",
    menu_open_project_editor: "编辑器打开项目",
    menu_stop: "停止",
    menu_delete: "删除",
    show_less: "收起",
    show_more_count: "再显示 {count} 条...",
    workspace_placeholder: "请选择一个会话以打开 Claude Code。",
    fallback_new_project: "新项目",
  },
  "en-US": {
    confirm_delete_session: "Delete this session? This cannot be undone.",
    confirm_delete_project: "Remove project \"{name}\" from sidebar?",
    status_ready: "Ready.",
    status_load_failed: "Failed to load projects/sessions.",
    status_project_create_cancelled: "Project creation canceled.",
    status_project_added: "Project added: {name}",
    status_project_create_failed: "Create project failed: {message}",
    status_session_deleted: "Session deleted.",
    status_session_delete_failed: "Failed to delete session.",
    status_stop_terminal_failed: "Failed to stop terminal session.",
    status_opened_in_app: "Opened in {app}.",
    status_open_terminal_failed: "Failed to open project in external terminal.",
    status_open_editor_failed: "Failed to open project in editor.",
    status_project_removed: "Project removed: {name}",
    status_project_delete_failed: "Delete project failed.",
    status_session_renamed: "Session renamed: {name}",
    status_session_rename_fallback: "Native session rename unavailable. Saved as local alias.",
    status_settings_load_failed: "Failed to load settings file. Using current in-memory state.",
    status_settings_save_failed: "Failed to save settings file.",
    status_reload_settings: "Settings reloaded from file.",
    status_terminal_write_failed: "Terminal write failed. Please retry or reopen the session.",
    status_terminal_start_failed: "Terminal failed to start: {message}",
    status_unexpected_error: "An unexpected error occurred. Check logs for details.",
    title_show_sidebar: "Show sidebar  ⌘B",
    title_hide_sidebar: "Hide sidebar  ⌘B",
    title_switch_to_light: "Switch to light",
    title_switch_to_dark: "Switch to dark",
    title_add_project: "Add project",
    title_settings_shortcut: "Settings  ⌘,",
    title_remove_project_sidebar: "Remove project from sidebar",
    title_quick_new_session: "Quick new Claude session",
    title_session_actions: "Session actions",
    title_drag_resize_sidebar: "Drag to resize sidebar",
    settings_title: "Settings",
    aria_close_settings: "Close settings",
    nav_claude: "Claude",
    nav_appearance: "Appearance",
    nav_integrations: "Integrations",
    section_language: "Language",
    language_zh_cn: "中文",
    language_en_us: "English",
    section_theme_mode: "Theme mode",
    theme_light: "Light",
    theme_dark: "Dark",
    theme_system: "System",
    hint_theme_palette:
      "Theme palette colors are stored in preferences.json. You can customize the values there for AI-driven theming.",
    section_external_terminal: "External terminal",
    section_external_editor: "External editor",
    hint_integrations:
      "Session quick actions use these defaults for \"Open project in terminal\" and \"Open project in editor\". All values are stored in preferences.json.",
    section_claude_startup: "Claude startup arguments",
    label_enable_custom_args: "Enable custom Claude startup arguments",
    hint_claude_startup:
      "When disabled, it uses default `claude --resume`. When enabled, the default argument is `--dangerously-skip-permissions`, and it applies to session resume and quick new session startup.",
    section_session_restore: "Session restore",
    label_restore_last_session: "Restore last opened session on launch",
    hint_restore_last_session:
      "Automatically re-open the last active session after app start. Turn this off to use most recent-session fallback behavior.",
    button_done: "Done",
    tree_no_sessions: "No sessions",
    tree_no_projects: "No projects yet",
    menu_edit_session_name: "Edit session name",
    menu_open_project_terminal: "Open project in terminal",
    menu_open_project_editor: "Open project in editor",
    menu_stop: "Stop",
    menu_delete: "Delete",
    show_less: "Show less",
    show_more_count: "Show {count} more...",
    workspace_placeholder: "Select a session to open Claude Code.",
    fallback_new_project: "New Project",
  },
} as const;

export type TranslationKey = keyof (typeof dictionaries)["zh-CN"];

const replaceParams = (template: string, params?: TranslationParams): string => {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!(key in params)) {
      return `{${key}}`;
    }

    return String(params[key]);
  });
};

export const resolveAppLanguage = (value: unknown): AppLanguage => {
  if (value === "en-US") {
    return "en-US";
  }

  return DEFAULT_APP_LANGUAGE;
};

export const createTranslator = (language: AppLanguage) => {
  const dictionary = dictionaries[language] ?? dictionaries[DEFAULT_APP_LANGUAGE];

  return (key: TranslationKey, params?: TranslationParams): string => {
    return replaceParams(dictionary[key], params);
  };
};
