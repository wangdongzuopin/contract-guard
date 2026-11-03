import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { App as AntApp, Button } from 'antd';
import { ArrowRightOutlined, CopyOutlined } from '@ant-design/icons';
import { formatClauseNumber, type Finding } from '@cg/core';
import { cx } from '../../../ui/dom';
import { useI18n } from '../../../ui/i18n';

export default function FindingItem({
  itemKey,
  index,
  finding: f,
  selected,
  tabbable,
  page,
  onSelect,
}: {
  itemKey: string;
  index: number;
  finding: Finding;
  selected: boolean;
  tabbable: boolean;
  page?: number;
  onSelect(key: string): void;
}) {
  const { t, locale } = useI18n();
  const { message } = AntApp.useApp();

  const where = f.clauseNumber
    ? formatClauseNumber(f.clauseNumber, locale)
    : f.kind === 'missing'
      ? t.missingWhere
      : '';
  const location = [where, page ? t.pageShort(page) : ''].filter(Boolean).join(' · ');

  const copy = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(f.advice);
      void message.success(t.copied);
    } catch {
      void message.error(t.copyFailed);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(itemKey);
    }
  };

  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={tabbable ? 0 : -1}
      data-key={itemKey}
      data-rule={f.ruleId}
      className={cx('cg-finding', `cg-finding--${f.severity}`, selected && 'is-selected')}
      style={{ '--i': Math.min(index, 12) } as CSSProperties}
      onClick={() => onSelect(itemKey)}
      onKeyDown={onKeyDown}
    >
      <div className="cg-finding__head">
        <span className="cg-sev">{t.severityShort[f.severity]}</span>
        <span className="cg-finding__title">{f.ruleTitle}</span>
        {location && <span className="cg-finding__where">{location}</span>}
      </div>

      <Evidence finding={f} />

      {selected && (
        <div className="cg-finding__advice">
          <div className="cg-finding__advice-head">
            <span>{t.advice}</span>
            <Button size="small" type="text" icon={<CopyOutlined />} onClick={(e) => void copy(e)}>
              {t.copy}
            </Button>
          </div>
          <p>{f.advice}</p>
          {f.kind === 'missing' && <p className="cg-finding__note">{t.notLocatable}</p>}
        </div>
      )}
    </div>
  );
}

/** 一行说清「合同写了什么、红线是多少、差多少」 */
function Evidence({ finding: f }: { finding: Finding }) {
  const { t } = useI18n();

  if (f.kind === 'limit') {
    return (
      <div className="cg-evidence">
        <span className="cg-evidence__label">{t.contract}</span>
        <span className="cg-evidence__value">{f.actual}</span>
        <ArrowRightOutlined className="cg-evidence__sep" />
        <span className="cg-evidence__label">{t.redLine}</span>
        <span className="cg-evidence__value">
          {f.bound === 'min' ? '≥' : '≤'} {f.limit}
        </span>
        {f.delta && <span className="cg-delta">{f.delta}</span>}
      </div>
    );
  }

  if (f.kind === 'forbidden') {
    return (
      <div className="cg-evidence">
        <span className="cg-evidence__label">{t.found}</span>
        <mark className="cg-quote">{f.actual}</mark>
      </div>
    );
  }

  return (
    <div className="cg-evidence">
      <span className="cg-evidence__label">{t.lookedFor}</span>
      <span className="cg-evidence__terms">{(f.expected ?? []).join(' / ')}</span>
    </div>
  );
}
