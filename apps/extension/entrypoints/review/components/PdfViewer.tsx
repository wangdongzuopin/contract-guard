import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, InputNumber, Switch, Tooltip } from 'antd';
import { ColumnWidthOutlined, LeftOutlined, MinusOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import type { Finding } from '@cg/core';
import { findingKey, type HighlightRect } from '../../../lib/findings';
import type { PdfHandle } from '../../../lib/pdf';
import { cx, prefersReducedMotion } from '../../../ui/dom';
import { useI18n } from '../../../ui/i18n';
import type { Selection } from '../types';
import PdfPage, { type PageMark } from './PdfPage';

/** 可选缩放档位 */
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5];
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
/** 适合宽度时左右各留的空白，与 .cg-viewer__pages 的左右 padding 一致 */
const SIDE_PADDING = 32;
/** 适合宽度的上限：窗口很宽时放得太大反而难读 */
const MAX_FIT_SCALE = 1.75;
/** 当前页判定线：视口顶部往下 30% */
const READING_LINE = 0.3;
const NO_MARKS: PageMark[] = [];

type Zoom = { mode: 'fit' } | { mode: 'manual'; scale: number };

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * PDF 预览：连续滚动、按需渲染、缩放、页内高亮。
 *
 * 高亮与清单双向联动：在清单里选中 → 滚到高亮；点高亮 → 选中清单项。
 */
export default function PdfViewer({
  handle,
  findings,
  locations,
  selection,
  onSelect,
}: {
  handle: PdfHandle;
  /** 按当前筛选过滤后的发现项 —— 筛选同样作用于页内高亮 */
  findings: Finding[];
  locations: Map<string, HighlightRect[]>;
  selection: Selection | null;
  onSelect(key: string): void;
}) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapRefs = useRef<(HTMLDivElement | null)[]>([]);
  /** 当前看到的位置（第几页 + 页内比例），缩放后据此滚回原处 */
  const anchor = useRef<{ index: number; offset: number } | null>(null);
  const frame = useRef(0);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState<Zoom>({ mode: 'fit' });
  const [page, setPage] = useState(1);
  const [showMarks, setShowMarks] = useState(true);

  const maxPageWidth = useMemo(() => Math.max(1, ...handle.pages.map((p) => p.width)), [handle]);
  const fitScale = width > 0 ? clamp((width - SIDE_PADDING * 2) / maxPageWidth, MIN_SCALE, MAX_FIT_SCALE) : 1;
  const scale = zoom.mode === 'fit' ? fitScale : zoom.scale;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      const line = el.scrollTop + el.clientHeight * READING_LINE;
      let index = 0;
      for (let i = 0; i < wrapRefs.current.length; i += 1) {
        const w = wrapRefs.current[i];
        if (!w) continue;
        if (w.offsetTop <= line) index = i;
        else break;
      }
      const w = wrapRefs.current[index];
      if (w) anchor.current = { index, offset: (el.scrollTop - w.offsetTop) / Math.max(1, w.offsetHeight) };
      setPage(index + 1);
    });
  }, []);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // 缩放后回到缩放前看到的位置
  const prevScale = useRef(scale);
  useLayoutEffect(() => {
    if (prevScale.current === scale) return;
    prevScale.current = scale;
    const el = scrollRef.current;
    const a = anchor.current;
    const w = a ? wrapRefs.current[a.index] : null;
    if (el && a && w) el.scrollTop = w.offsetTop + a.offset * w.offsetHeight;
  }, [scale]);

  // 在清单里选中风险项：把它的第一处高亮滚到视口上部
  useEffect(() => {
    if (!selection || selection.origin === 'viewer') return;
    const rect = locations.get(selection.key)?.[0];
    const el = scrollRef.current;
    const pageEl = rect ? wrapRefs.current[rect.page - 1]?.querySelector<HTMLElement>('.cg-page') : null;
    if (!rect || !el || !pageEl) return;
    el.scrollTo({
      top: Math.max(0, pageEl.offsetTop + rect.y * scale - el.clientHeight * 0.3),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
    // 只在选中变化时滚动；缩放时的位置由上面的锚点逻辑负责
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const goToPage = (n: number) => {
    const el = scrollRef.current;
    const w = wrapRefs.current[clamp(Math.round(n) || 1, 1, handle.pageCount) - 1];
    if (el && w) el.scrollTo({ top: Math.max(0, w.offsetTop - 12), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  const zoomBy = (dir: 1 | -1) => {
    const next =
      dir > 0
        ? (ZOOM_STEPS.find((z) => z > scale + 0.01) ?? MAX_SCALE)
        : ([...ZOOM_STEPS].reverse().find((z) => z < scale - 0.01) ?? MIN_SCALE);
    setZoom({ mode: 'manual', scale: next });
  };

  const marksByPage = useMemo(() => {
    const map = new Map<number, PageMark[]>();
    if (!showMarks) return map;
    for (const f of findings) {
      const key = findingKey(f);
      for (const rect of locations.get(key) ?? []) {
        const list = map.get(rect.page) ?? [];
        list.push({ key, severity: f.severity, title: f.ruleTitle, rect });
        map.set(rect.page, list);
      }
    }
    return map;
  }, [findings, locations, showMarks]);

  return (
    <section className="cg-viewer" aria-label={t.viewerLabel}>
      <div className="cg-viewer__bar">
        <div className="cg-viewer__group">
          <Tooltip title={t.prevPage}>
            <Button id="prev" type="text" icon={<LeftOutlined />} aria-label={t.prevPage} disabled={page <= 1} onClick={() => goToPage(page - 1)} />
          </Tooltip>
          <InputNumber
            key={page}
            id="page-input"
            className="cg-viewer__page"
            size="small"
            min={1}
            max={handle.pageCount}
            defaultValue={page}
            controls={false}
            aria-label={t.pageInput}
            onPressEnter={(e) => goToPage(Number((e.target as HTMLInputElement).value))}
          />
          <span id="pageinfo" className="cg-viewer__total">
            / {handle.pageCount}
          </span>
          <Tooltip title={t.nextPage}>
            <Button
              id="next"
              type="text"
              icon={<RightOutlined />}
              aria-label={t.nextPage}
              disabled={page >= handle.pageCount}
              onClick={() => goToPage(page + 1)}
            />
          </Tooltip>
        </div>

        <div className="cg-viewer__group">
          <Tooltip title={t.zoomOut}>
            <Button id="zoom-out" type="text" icon={<MinusOutlined />} aria-label={t.zoomOut} disabled={scale <= MIN_SCALE + 0.001} onClick={() => zoomBy(-1)} />
          </Tooltip>
          <span id="zoom-level" className="cg-viewer__zoom">
            {Math.round(scale * 100)}%
          </span>
          <Tooltip title={t.zoomIn}>
            <Button id="zoom-in" type="text" icon={<PlusOutlined />} aria-label={t.zoomIn} disabled={scale >= MAX_SCALE - 0.001} onClick={() => zoomBy(1)} />
          </Tooltip>
          <Tooltip title={t.fitWidth}>
            <Button
              id="zoom-fit"
              type="text"
              icon={<ColumnWidthOutlined />}
              aria-label={t.fitWidth}
              aria-pressed={zoom.mode === 'fit'}
              className={cx('cg-viewer__fit', zoom.mode === 'fit' && 'is-active')}
              onClick={() => setZoom({ mode: 'fit' })}
            />
          </Tooltip>
        </div>

        <label className="cg-viewer__marks">
          <Switch id="toggle-marks" size="small" checked={showMarks} onChange={setShowMarks} />
          {t.highlights}
        </label>
      </div>

      <div ref={scrollRef} className="cg-viewer__scroll" onScroll={onScroll}>
        <div className="cg-viewer__pages">
          {width > 0 &&
            handle.pages.map((size, i) => (
              <div
                key={i}
                className="cg-page-wrap"
                ref={(el) => {
                  wrapRefs.current[i] = el;
                }}
              >
                <PdfPage
                  handle={handle}
                  pageNumber={i + 1}
                  size={size}
                  scale={scale}
                  rootRef={scrollRef}
                  marks={marksByPage.get(i + 1) ?? NO_MARKS}
                  selectedKey={selection?.key ?? null}
                  onSelect={onSelect}
                />
                <span className="cg-page__label">
                  {i + 1} / {handle.pageCount}
                </span>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
