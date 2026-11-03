import { docTypeLabel, formatClauseNumber, scoreBand, type Finding, type Locale, type Report } from '@cg/core';
import { MESSAGES, type Messages } from './i18n';
import { BAND_COLOR, FONT_STACK, PALETTE, SEVERITY_TONE } from './palette';

/**
 * 导出审查报告为自包含 HTML —— 无需服务器，双击即可打开，便于转发给法务/领导，
 * 也可以在浏览器里直接打印成 PDF。
 *
 * 来自文件的内容（文件名、合同原文摘录）一律转义。
 */

function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LOGO = `<svg width="22" height="22" viewBox="0 0 128 128" aria-hidden="true"><rect x="4" y="4" width="120" height="120" rx="30" fill="${PALETTE.brand}"/><path d="M38 22h36l22 22v58a8 8 0 0 1-8 8H38a8 8 0 0 1-8-8V30a8 8 0 0 1 8-8z" fill="#fff"/><path d="M74 22v16a6 6 0 0 0 6 6h16z" fill="#C9D3FB"/><rect x="42" y="56" width="38" height="8" rx="4" fill="#C3CCDA"/><rect x="38" y="70" width="50" height="14" rx="4" fill="#FBBF24"/><rect x="42" y="90" width="26" height="8" rx="4" fill="#C3CCDA"/></svg>`;

/** 下载文件名：「原文件名-审查报告.html」/「name-review-report.html」 */
export function reportFileName(report: Report, locale: Locale = report.meta.locale): string {
  const r = MESSAGES[locale].report;
  const base = (report.meta.fileName ?? r.defaultName).replace(/\.pdf$/i, '');
  return `${base}-${r.fileSuffix}.html`;
}

function findingRow(f: Finding, m: Messages, locale: Locale): string {
  const tone = SEVERITY_TONE[f.severity];
  const where = f.clauseNumber
    ? formatClauseNumber(f.clauseNumber, locale)
    : f.kind === 'missing'
      ? m.missingWhere
      : '—';
  const actual =
    f.kind === 'missing'
      ? `<span class="muted">${esc(m.lookedFor)}${esc(m.colon)}${esc((f.expected ?? []).join(' / '))}</span>`
      : f.actual
        ? `<code>${esc(f.actual)}</code>`
        : '—';
  const limit = f.limit
    ? `<code>${f.bound === 'min' ? '≥' : '≤'} ${esc(f.limit)}</code>${
        f.delta ? `<div class="delta" style="color:${tone.text}">${esc(f.delta)}</div>` : ''
      }`
    : '—';

  return `<tr>
  <td><span class="sev" style="color:${tone.text};background:${tone.soft};border-color:${tone.border}">${esc(m.severity[f.severity])}</span></td>
  <td><strong>${esc(f.ruleTitle)}</strong><div class="msg">${esc(f.message)}</div></td>
  <td class="nowrap">${esc(where)}</td>
  <td>${actual}</td>
  <td>${limit}</td>
  <td class="advice">${esc(f.advice)}</td>
</tr>`;
}

export function reportToHtml(report: Report, locale: Locale = report.meta.locale): string {
  const m = MESSAGES[locale];
  const r = m.report;
  const { summary, meta, findings } = report;
  const band = scoreBand(summary.score);
  const bandLabel = meta.languageSupported ? m.band[band] : m.bandUnsupported;
  const bandColor = meta.languageSupported ? BAND_COLOR[band] : PALETTE.faint;
  const numberLocale = locale === 'zh' ? 'zh-CN' : 'en-US';
  const created = new Date(meta.createdAt).toLocaleString(numberLocale, { hour12: false });
  const docType = meta.docType ?? 'unknown';
  const docLine =
    docType === 'unknown'
      ? r.docTypeUnknown
      : r.docTypeKnown(docTypeLabel(docType, locale), meta.skippedByType ?? 0);
  const fileName = meta.fileName ?? '—';

  const rows = findings.map((f) => findingRow(f, m, locale)).join('\n');
  const counts = (['high', 'medium', 'low'] as const)
    .map((sev) => `<li style="--c:${SEVERITY_TONE[sev].solid}"><b>${summary[sev]}</b>${esc(m.severity[sev])}</li>`)
    .join('');
  const warning = meta.languageSupported
    ? ''
    : `<div class="warn"><strong>${esc(m.languageWarning.title)}</strong> ${esc(m.languageWarning.desc)}</div>`;

  return `<!DOCTYPE html>
<html lang="${locale === 'zh' ? 'zh-CN' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(r.title)} · ${esc(fileName)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: ${PALETTE.canvas}; color: ${PALETTE.ink}; font: 14px/1.6 ${FONT_STACK}; -webkit-font-smoothing: antialiased; }
  main { max-width: 1120px; margin: 0 auto; padding: 40px 32px 56px; }
  .brand { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: ${PALETTE.muted}; }
  h1 { margin: 12px 0 14px; font-size: 26px; line-height: 1.3; font-weight: 650; letter-spacing: -0.01em; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 28px; margin: 0; font-size: 13px; }
  .meta div { display: flex; gap: 6px; }
  .meta dt { color: ${PALETTE.subtle}; }
  .meta dd { margin: 0; color: ${PALETTE.text}; font-weight: 500; }
  .summary { display: grid; grid-template-columns: auto 1fr auto; gap: 24px; align-items: center; margin: 28px 0 20px; padding: 24px 28px; background: #fff; border: 1px solid ${PALETTE.hairline}; border-radius: 16px; }
  .score { position: relative; width: 96px; height: 96px; border-radius: 50%; display: grid; place-items: center; text-align: center; background: conic-gradient(var(--band) calc(var(--p) * 1%), ${PALETTE.hairline} 0); }
  .score::before { content: ''; position: absolute; inset: 9px; border-radius: 50%; background: #fff; }
  .score > span { position: relative; }
  .score .n { display: block; font-size: 28px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
  .score .l { display: block; margin-top: 4px; font-size: 11px; color: ${PALETTE.subtle}; }
  .band { display: inline-block; padding: 2px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; color: #fff; background: var(--band); }
  .verdict p { margin: 8px 0 0; }
  .note { color: ${PALETTE.subtle}; font-size: 13px; }
  .counts { list-style: none; margin: 0; padding: 0; display: flex; gap: 10px; }
  .counts li { min-width: 76px; padding: 10px 12px; border-radius: 12px; background: ${PALETTE.fill}; font-size: 12px; color: ${PALETTE.muted}; text-align: center; }
  .counts b { display: block; font-size: 22px; line-height: 1.2; color: var(--c); font-variant-numeric: tabular-nums; }
  .warn { margin: 0 0 20px; padding: 12px 16px; border-radius: 12px; background: #FFF7E6; border: 1px solid #FCD9A0; color: #92400E; font-size: 13px; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; background: #fff; border: 1px solid ${PALETTE.hairline}; border-radius: 16px; overflow: hidden; font-size: 13px; }
  th { text-align: left; font-weight: 600; font-size: 12px; color: ${PALETTE.subtle}; background: ${PALETTE.fill}; padding: 10px 14px; border-bottom: 1px solid ${PALETTE.hairline}; }
  td { padding: 14px; vertical-align: top; border-bottom: 1px solid ${PALETTE.hairline}; }
  tr:last-child td { border-bottom: 0; }
  .sev { display: inline-block; white-space: nowrap; padding: 1px 8px; border: 1px solid; border-radius: 6px; font-size: 12px; font-weight: 600; }
  .msg { margin-top: 4px; color: ${PALETTE.muted}; font-size: 12.5px; }
  code { font-family: inherit; font-weight: 600; background: ${PALETTE.fill}; padding: 1px 6px; border-radius: 5px; white-space: nowrap; }
  .delta { margin-top: 4px; font-size: 12px; font-weight: 600; }
  .advice { min-width: 240px; color: ${PALETTE.text}; }
  .muted { color: ${PALETTE.muted}; }
  .nowrap { white-space: nowrap; }
  footer { margin-top: 24px; font-size: 12px; color: ${PALETTE.subtle}; line-height: 1.8; }
  @media print {
    body { background: #fff; }
    main { max-width: none; padding: 0; }
    tr { break-inside: avoid; }
  }
  @media (max-width: 760px) {
    main { padding: 24px 16px; }
    .summary { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<main>
  <header>
    <div class="brand">${LOGO}<span>${esc(m.appFullName)}</span></div>
    <h1>${esc(r.title)}</h1>
    <dl class="meta">
      <div><dt>${esc(r.file)}</dt><dd>${esc(fileName)}</dd></div>
      <div><dt>${esc(r.pages)}</dt><dd>${esc(meta.pageCount ?? '—')}</dd></div>
      <div><dt>${esc(r.chars)}</dt><dd>${esc(meta.charCount.toLocaleString(numberLocale))}</dd></div>
      <div><dt>${esc(r.generated)}</dt><dd>${esc(created)}</dd></div>
      <div><dt>${esc(r.ruleSet)}</dt><dd>${esc(meta.ruleSetVersion)}</dd></div>
    </dl>
  </header>

  <section class="summary" style="--band:${bandColor};--p:${summary.score}">
    <div class="score"><span><span class="n">${summary.score}</span><span class="l">${esc(r.score)}</span></span></div>
    <div class="verdict">
      <span class="band">${esc(bandLabel)}</span>
      <p><strong>${esc(summary.verdict)}</strong></p>
      <p class="note">${esc(r.docType)}${esc(m.colon)}${esc(docLine)}</p>
      <p class="note">${esc(r.reproducible)}</p>
    </div>
    <ul class="counts">${counts}<li style="--c:${PALETTE.ink}"><b>${summary.total}</b>${esc(r.total)}</li></ul>
  </section>

  ${warning}

  <table>
    <thead><tr><th>${esc(r.columns.severity)}</th><th>${esc(r.columns.finding)}</th><th>${esc(r.columns.location)}</th><th>${esc(r.columns.actual)}</th><th>${esc(r.columns.limit)}</th><th>${esc(r.columns.advice)}</th></tr></thead>
    <tbody>
${rows || `<tr><td colspan="6">${esc(r.noFindings)}</td></tr>`}
    </tbody>
  </table>

  <footer>
    ${esc(r.ruleSet)} ${esc(meta.ruleSetVersion)} · ${esc(r.toolVersion)} ${esc(meta.toolVersion)}<br>
    ${esc(r.footerLegal)}<br>
    ${esc(r.footerLocal)}
  </footer>
</main>
</body>
</html>`;
}

/** 触发浏览器下载 */
export function downloadHtml(filename: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
