import { useEffect, useRef, type KeyboardEvent } from 'react';
import { CheckCircleFilled } from '@ant-design/icons';
import type { Finding } from '@cg/core';
import { findingKey, type HighlightRect } from '../../../lib/findings';
import { prefersReducedMotion } from '../../../ui/dom';
import { useI18n } from '../../../ui/i18n';
import FindingItem from './FindingItem';

/**
 * 风险清单（listbox）
 *
 * 键盘：↑ ↓ 切换，Home / End 跳到首尾，Enter 选中；Esc 取消选中由 App 统一处理。
 * 只有一项可 Tab 聚焦（roving tabindex），Tab 一次就能离开清单。
 */
export default function FindingList({
  total,
  findings,
  selectedKey,
  onSelect,
  locations,
}: {
  /** 筛选前的总数，用来区分「完全没有风险」和「这个等级下没有」 */
  total: number;
  findings: Finding[];
  selectedKey: string | null;
  onSelect(key: string): void;
  locations: Map<string, HighlightRect[]>;
}) {
  const { t } = useI18n();
  const listRef = useRef<HTMLDivElement>(null);
  const keys = findings.map(findingKey);
  const active = selectedKey ? keys.indexOf(selectedKey) : -1;

  const itemOf = (key: string) =>
    listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) ?? null;

  // 选中项变化（键盘切换、在 PDF 上点选）时，把它滚进可见区域
  useEffect(() => {
    if (!selectedKey) return;
    itemOf(selectedKey)?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  if (total === 0) {
    return (
      <div id="findings" className="cg-list cg-list--empty">
        <CheckCircleFilled className="cg-list__ok" />
        <strong>{t.noFindings.title}</strong>
        <span>{t.noFindings.desc}</span>
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div id="findings" className="cg-list cg-list--empty">
        <span>{t.noFindingsInFilter}</span>
      </div>
    );
  }

  const move = (to: number) => {
    const key = keys[Math.min(keys.length - 1, Math.max(0, to))];
    if (!key) return;
    onSelect(key);
    itemOf(key)?.focus({ preventScroll: true });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(active + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(active < 0 ? keys.length - 1 : active - 1);
        break;
      case 'Home':
        e.preventDefault();
        move(0);
        break;
      case 'End':
        e.preventDefault();
        move(keys.length - 1);
        break;
      default:
    }
  };

  return (
    <div id="findings" ref={listRef} className="cg-list" role="listbox" aria-label={t.findingsTitle} onKeyDown={onKeyDown}>
      {findings.map((f, i) => {
        const key = keys[i]!;
        return (
          <FindingItem
            key={key}
            itemKey={key}
            index={i}
            finding={f}
            selected={key === selectedKey}
            tabbable={key === selectedKey || (active < 0 && i === 0)}
            page={locations.get(key)?.[0]?.page}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
