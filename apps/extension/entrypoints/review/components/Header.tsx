import { Button, Tooltip } from 'antd';
import {
  CloseOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  FolderOpenOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useI18n } from '../../../ui/i18n';
import LanguageSwitch from '../../../ui/LanguageSwitch';

export interface FileInfo {
  fileName: string;
  pageCount: number;
  durationMs: number;
}

export default function Header({
  file,
  canExport,
  onOpen,
  onClose,
  onExport,
}: {
  file: FileInfo | null;
  canExport: boolean;
  onOpen(): void;
  onClose(): void;
  onExport(): void;
}) {
  const { t } = useI18n();

  return (
    <header className="cg-header">
      <div className="cg-brand">
        <img src="/logo.svg" width={28} height={28} alt="" />
        <span className="cg-brand__name">{t.appName}</span>
        <Tooltip title={t.localBadgeTip} placement="bottomLeft">
          <span className="cg-trust" tabIndex={0}>
            <SafetyCertificateOutlined />
            {t.localBadge}
          </span>
        </Tooltip>
      </div>

      {file && (
        <div className="cg-file" title={file.fileName}>
          <FilePdfOutlined className="cg-file__icon" />
          <span id="file-name" className="cg-file__name">
            {file.fileName}
          </span>
          <span id="stats" className="cg-file__meta">
            {t.fileMeta(file.pageCount, file.durationMs)}
          </span>
          <Tooltip title={t.closeFile}>
            <Button id="close-file" type="text" size="small" icon={<CloseOutlined />} aria-label={t.closeFile} onClick={onClose} />
          </Tooltip>
        </div>
      )}

      <div className="cg-header__actions">
        <LanguageSwitch />
        {file && (
          <>
            <Tooltip title="Ctrl + O">
              <Button id="pick" icon={<FolderOpenOutlined />} onClick={onOpen}>
                {t.openFile}
              </Button>
            </Tooltip>
            <Tooltip title={t.exportTip}>
              <Button id="export" type="primary" icon={<DownloadOutlined />} disabled={!canExport} onClick={onExport}>
                {t.export}
              </Button>
            </Tooltip>
          </>
        )}
      </div>
    </header>
  );
}
