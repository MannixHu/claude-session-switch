import type { TranslationParams, TranslationKey } from "../lib/i18n";
import type { UpdateState } from "../lib/updateFlow";
import type { UpdateChangelogRow } from "../lib/updateReleaseNotes";
import "./UpdateDialog.css";

type Translate = (key: TranslationKey, params?: TranslationParams) => string;

type UpdateDialogProps = {
  isOpen: boolean;
  state: UpdateState;
  publishedAtLabel: string;
  changelogRows: UpdateChangelogRow[];
  summaryNotes: string;
  downloadedPath: string;
  canClose: boolean;
  t: Translate;
  onClose: () => void;
  onDownload: () => void;
  onOpenRelease: () => void;
};

export default function UpdateDialog({
  isOpen,
  state,
  publishedAtLabel,
  changelogRows,
  summaryNotes,
  downloadedPath,
  canClose,
  t,
  onClose,
  onDownload,
  onOpenRelease,
}: UpdateDialogProps) {
  if (!isOpen) {
    return null;
  }

  const metadata = state.metadata;
  const latestVersion = metadata?.latest_version ?? "";
  const currentVersion = metadata?.current_version ?? "";
  const releaseUrl = metadata?.release_url?.trim() ?? "";
  const canDownload =
    state.phase === "available" && Boolean(metadata?.download_url && metadata?.asset_name);

  const titleByPhase: Record<UpdateState["phase"], string> = {
    idle: t("update_dialog_title"),
    checking: t("update_dialog_title_checking"),
    available: t("update_dialog_title_available"),
    downloading: t("update_dialog_title_downloading"),
    up_to_date: t("update_dialog_title_up_to_date"),
    completed: t("update_dialog_title_completed"),
    error: t("update_dialog_title_error"),
  };

  return (
    <div className="update-dialog-overlay" onClick={canClose ? onClose : undefined}>
      <div className="update-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="update-dialog-header">
          <div>
            <h3>{titleByPhase[state.phase]}</h3>
            <p className="update-dialog-subtitle">{t("update_dialog_subtitle")}</p>
          </div>
          <button
            className="update-dialog-close"
            onClick={onClose}
            disabled={!canClose}
            aria-label={t("aria_close_update_dialog")}
          >
            ×
          </button>
        </div>

        <div className="update-dialog-body">
          <div className="update-dialog-summary-grid">
            <div className="update-dialog-summary-card">
              <span className="update-dialog-summary-label">{t("update_dialog_current_version")}</span>
              <strong>{currentVersion || "—"}</strong>
            </div>
            <div className="update-dialog-summary-card">
              <span className="update-dialog-summary-label">{t("update_dialog_latest_version")}</span>
              <strong>{latestVersion || "—"}</strong>
            </div>
            <div className="update-dialog-summary-card">
              <span className="update-dialog-summary-label">{t("update_dialog_published_at")}</span>
              <strong>{publishedAtLabel || "—"}</strong>
            </div>
            <div className="update-dialog-summary-card">
              <span className="update-dialog-summary-label">{t("update_dialog_status")}</span>
              <strong>{t(`update_dialog_phase_${state.phase}` as TranslationKey)}</strong>
            </div>
          </div>

          {state.phase === "error" && (
            <div className="update-dialog-callout error">
              <strong>{t("update_dialog_error_label")}</strong>
              <p>{state.error || t("status_unexpected_error")}</p>
            </div>
          )}

          {state.phase === "completed" && (
            <div className="update-dialog-callout success">
              <strong>{t("update_dialog_install_ready")}</strong>
              <p>{t("update_dialog_install_guidance", { version: latestVersion || currentVersion })}</p>
              {downloadedPath && <code className="update-dialog-path">{downloadedPath}</code>}
            </div>
          )}

          {(state.phase === "available" ||
            state.phase === "downloading" ||
            state.phase === "completed" ||
            state.phase === "up_to_date") && (
            <>
              {changelogRows.length > 0 && (
                <div className="update-dialog-section">
                  <h4>{t("update_dialog_changelog")}</h4>
                  <div className="update-dialog-table-wrap">
                    <table className="update-dialog-table">
                      <thead>
                        <tr>
                          <th>{t("update_dialog_commit")}</th>
                          <th>{t("update_dialog_description")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changelogRows.map((row) => (
                          <tr key={`${row.commit}-${row.description}`}>
                            <td>
                              <code>{row.commit}</code>
                            </td>
                            <td>{row.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="update-dialog-section">
                <h4>{t("update_dialog_release_notes")}</h4>
                {summaryNotes ? (
                  <div className="update-dialog-notes">{summaryNotes}</div>
                ) : (
                  <p className="update-dialog-empty">{t("update_dialog_no_release_notes")}</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="update-dialog-actions">
          {releaseUrl && (
            <button className="update-dialog-secondary" onClick={onOpenRelease}>
              {t("update_dialog_open_github")}
            </button>
          )}
          {canDownload && (
            <button className="update-dialog-primary" onClick={onDownload}>
              {t("update_dialog_download")}
            </button>
          )}
          {(state.phase === "checking" || state.phase === "downloading") && (
            <button className="update-dialog-primary" disabled>
              {t("update_dialog_working")}
            </button>
          )}
          <button className="update-dialog-secondary" onClick={onClose} disabled={!canClose}>
            {canClose ? t("update_dialog_close") : t("update_dialog_working")}
          </button>
        </div>
      </div>
    </div>
  );
}
