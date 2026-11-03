import { Alert, Progress, Segmented, Tooltip } from 'antd';
import { FileTextOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { docTypeLabel, scoreBand, type Finding, type Report, type Severity } from '@cg/core';
import type { HighlightRect } from '../../../lib/findings';
import { BAND_COLOR, PALETTE } from '../../../lib/palette';
import { useI18n } from '../../../ui/i18n';
import type { SeverityFilter } from '../types';
import FindingList from './FindingList';

const SEVERITIES: Severity[] = ['high', 'medium', 'low'];

export default function Sidebar({
  report,
  findings,
  filter,
  onFilterChange,
  selectedKey,
  onSelect,
  locations,
}: {
  report: Report;
  /** 按当前筛选过滤后的发现项 */
  findings: Finding[];
  filter: SeverityFilter;
  onFilterChange(next: SeverityFilter): void;
  selectedKey: string | null;
  onSelect(key: string): void;
  locations: Map<string, HighlightRect[]>;
}) {
  const { t, locale } = useI18n();
  const s = report.summary;
  const band = scoreBand(s.score);
  const reliable = report.meta.languageSupported;
  const docType = report.meta.docType ?? 'unknown';
  const skipped = report.meta.skippedByType ?? 0;

  return (
    <aside className="cg-sidebar">
      <section id="summary" className="cg-summary" aria-label={t.summaryLabel}>
        <div className="cg-summary__top">
          <Tooltip title={t.scoreTip} placement="bottomLeft">
            <div className="cg-score" tabIndex={0} aria-label={`${t.scoreLabel} ${s.score}`}>
              <Progress
                type="circle"
                size={84}
                strokeWidth={9}
                percent={s.score}
                strokeColor={reliable ? BAND_COLOR[band] : PALETTE.faint}
                railColor={PALETTE.hairline}
                format={() => (
                  <span id="score" className="cg-score__value">
                    {s.score}
                  </span>
                )}
              />
              <span className="cg-score__label">{t.scoreLabel}</span>
            </div>
          </Tooltip>
          <div className="cg-verdict">
            <span id="band" className={`cg-band cg-band--${reliable ? band : 'unsupported'}`}>
              {reliable ? t.band[band] : t.bandUnsupported}
            </span>
            <p id="verdict">{s.verdict}</p>
          </div>
        </div>

        <div id="doctype" className={docType === 'unknown' ? 'cg-doctype cg-doctype--unknown' : 'cg-doctype'}>
          {docType === 'unknown' ? (
            <>
              <WarningOutlined />
              <span>{t.docTypeUnknown}</span>
            </>
          ) : (
            <>
              <FileTextOutlined />
              <span className="cg-doctype__label">{docTypeLabel(docType, locale)}</span>
              <span>{skipped > 0 ? t.docTypeSkipped(skipped) : t.docTypeAll}</span>
            </>
          )}
          <Tooltip title={t.docTypeTip}>
            <InfoCircleOutlined className="cg-doctype__info" aria-label={t.docTypeTip} />
          </Tooltip>
        </div>

        {!report.meta.languageSupported && (
          <Alert
            id="language-warning"
            className="cg-lang-warning"
            type="warning"
            showIcon
            title={t.languageWarning.title}
            description={t.languageWarning.desc}
          />
        )}
      </section>

      <div className="cg-filter">
        <Segmented<SeverityFilter>
          id="severity-filter"
          block
          value={filter}
          aria-label={t.filterLabel}
          onChange={onFilterChange}
          options={[
            {
              value: 'all',
              label: (
                <span className="cg-filter__opt" data-filter="all">
                  {t.filterAll}
                  <span className="cg-filter__count">{s.total}</span>
                </span>
              ),
            },
            ...SEVERITIES.map((sev) => ({
              value: sev,
              label: (
                <span className="cg-filter__opt" data-filter={sev}>
                  <i className={`cg-dot cg-dot--${sev}`} />
                  {t.severityShort[sev]}
                  <span className="cg-filter__count">{s[sev]}</span>
                </span>
              ),
            })),
          ]}
        />
      </div>

      <FindingList
        total={report.findings.length}
        findings={findings}
        selectedKey={selectedKey}
        onSelect={onSelect}
        locations={locations}
      />

      <footer className="cg-sidebar__foot">
        <span>{t.disclaimer}</span>
        <span>{report.meta.ruleSetVersion}</span>
      </footer>
    </aside>
  );
}
