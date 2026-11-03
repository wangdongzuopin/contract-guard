import { Alert, Button } from 'antd';
import {
  AimOutlined,
  ArrowRightOutlined,
  AuditOutlined,
  FilePdfOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useI18n } from '../../../ui/i18n';
import type { LoadError } from '../types';

const FEATURE_ICONS = [<SafetyCertificateOutlined key="local" />, <AuditOutlined key="rules" />, <AimOutlined key="locate" />];

export default function EmptyState({
  error,
  onDismissError,
  onPick,
  onSample,
}: {
  error: LoadError | null;
  onDismissError(): void;
  onPick(): void;
  onSample(): void;
}) {
  const { t } = useI18n();
  const copy = error ? t.errors[error.code] : null;

  return (
    <div className="cg-empty">
      <div className="cg-empty__inner">
        <h1 className="cg-empty__title">{t.heroTitle}</h1>
        <p className="cg-empty__subtitle">{t.heroSubtitle}</p>

        {error && copy && (
          <Alert
            id="load-error"
            className="cg-empty__alert"
            type={error.code === 'invalid' || error.code === 'unknown' ? 'error' : 'warning'}
            showIcon
            title={copy.title}
            description={error.detail ? t.withDetail(copy.desc, error.detail) : copy.desc}
            closable={{ onClose: onDismissError }}
          />
        )}

        <div
          id="dropzone"
          className="cg-dropzone"
          role="button"
          tabIndex={0}
          aria-label={`${t.dropTitle}, ${t.dropHint}`}
          onClick={onPick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onPick();
            }
          }}
        >
          <span className="cg-dropzone__icon" aria-hidden="true">
            <FilePdfOutlined />
          </span>
          <span className="cg-dropzone__title">{t.dropTitle}</span>
          <span className="cg-dropzone__hint">
            {t.dropHint}
            <kbd>Ctrl</kbd>
            <kbd>O</kbd>
          </span>
          <span className="cg-dropzone__meta">
            <LockOutlined />
            {t.dropMeta}
          </span>
        </div>

        <Button
          id="try-sample"
          className="cg-sample"
          type="link"
          icon={<ArrowRightOutlined />}
          iconPlacement="end"
          onClick={onSample}
        >
          {t.trySample}
        </Button>

        <ul className="cg-features">
          {t.features.map((f, i) => (
            <li key={f.title}>
              <span className="cg-features__icon" aria-hidden="true">
                {FEATURE_ICONS[i]}
              </span>
              <div>
                <strong>{f.title}</strong>
                <p>{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
