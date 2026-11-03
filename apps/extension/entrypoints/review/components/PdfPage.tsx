import { memo, useEffect, useRef, useState, type RefObject } from 'react';
import type { Severity } from '@cg/core';
import type { HighlightRect } from '../../../lib/findings';
import { isRenderCancelled, renderPage, type PageSize, type PdfHandle } from '../../../lib/pdf';
import { cx } from '../../../ui/dom';
import { useI18n } from '../../../ui/i18n';

export interface PageMark {
  key: string;
  severity: Severity;
  title: string;
  rect: HighlightRect;
}

/** 高亮框比文字盒子外扩一点：中文字形会略低于基线盒子，下方多留一些 */
const PAD_X = 2;
const PAD_TOP = 2;
const PAD_BOTTOM = 4;
/** 画布分辨率上限：高分屏按 2 倍渲染已经清晰，再高只是吃内存 */
const MAX_DPR = 2;

function PdfPage({
  handle,
  pageNumber,
  size,
  scale,
  rootRef,
  marks,
  selectedKey,
  onSelect,
}: {
  handle: PdfHandle;
  pageNumber: number;
  size: PageSize;
  scale: number;
  rootRef: RefObject<HTMLDivElement | null>;
  marks: PageMark[];
  selectedKey: string | null;
  onSelect(key: string): void;
}) {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(pageNumber <= 2);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const width = Math.round(size.width * scale);
  const height = Math.round(size.height * scale);

  // 只渲染视口上下一屏以内的页，离开后释放画布 —— 长合同不会把内存吃光
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last) setNear(last.isIntersecting);
      },
      { root: rootRef.current, rootMargin: '100% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!near) {
      canvas.width = 0;
      canvas.height = 0;
      setReady(false);
      return;
    }

    let active = true;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const job = renderPage(handle, pageNumber, scale * dpr);
    job.promise
      .then((bitmap) => {
        if (!active) return;
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
        bitmap.width = 0;
        bitmap.height = 0;
        setReady(true);
        setFailed(false);
      })
      .catch((err: unknown) => {
        if (!active || isRenderCancelled(err)) return;
        // 预览是锦上添花，风险清单才是本体 —— 渲染失败也照常出结果
        console.warn('[contract-guard] 页面渲染失败', pageNumber, err);
        setFailed(true);
      });

    return () => {
      active = false;
      job.cancel();
    };
  }, [handle, pageNumber, scale, near]);

  return (
    <div ref={hostRef} className={cx('cg-page', ready && 'is-ready')} data-page={pageNumber} style={{ width, height }}>
      <canvas ref={canvasRef} className="cg-page__canvas" style={{ width, height }} />
      {failed && <div className="cg-page__error">{t.renderFailed}</div>}
      {marks.length > 0 && (
        <div className="cg-page__marks">
          {marks.map((m, i) => (
            <div
              key={`${m.key}#${i}`}
              className={cx('cg-hl', `cg-hl--${m.severity}`, m.key === selectedKey && 'is-selected')}
              data-key={m.key}
              title={m.title}
              style={{
                left: m.rect.x * scale - PAD_X,
                top: m.rect.y * scale - PAD_TOP,
                width: m.rect.width * scale + PAD_X * 2,
                height: m.rect.height * scale + PAD_TOP + PAD_BOTTOM,
              }}
              onClick={() => onSelect(m.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(PdfPage);
