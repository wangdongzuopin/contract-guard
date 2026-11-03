import { Progress } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import { PALETTE } from '../../../lib/palette';
import { useI18n } from '../../../ui/i18n';
import type { LoadProgress } from '../types';

export default function LoadingState({ progress }: { progress: LoadProgress }) {
  const { t } = useI18n();
  const { stage, done, total, fileName } = progress;

  const parsing = stage === 'parse' && total > 0;
  const percent = stage === 'analyze' ? 100 : parsing ? Math.max(4, Math.round((done / total) * 92)) : 4;
  const label =
    stage === 'analyze'
      ? t.loading.analyzing
      : parsing
        ? t.loading.parsing(Math.min(total, done + 1), total)
        : t.loading.reading;

  return (
    <div id="loading" className="cg-loading" role="status" aria-live="polite">
      <div className="cg-loading__card">
        <span className="cg-loading__icon">
          <FilePdfOutlined />
        </span>
        <div className="cg-loading__name" title={fileName}>
          {fileName}
        </div>
        <Progress percent={percent} showInfo={false} status="active" strokeColor={PALETTE.brand} railColor={PALETTE.fill} />
        <div className="cg-loading__label">{label}</div>
      </div>
    </div>
  );
}
