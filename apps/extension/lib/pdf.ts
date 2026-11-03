import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { buildText, detectGutter, groupIntoRows, rowsToLines, type PdfLine, type RawItem } from './pdf-lines';

/**
 * PDF 本地解析（pdf.js，全部在浏览器内完成，文件不出本机）
 *
 * 行重组的纯逻辑在 pdf-lines.ts，这里只负责驱动 pdf.js。
 *
 * 注意：pdf.js 的 getDocument({ data }) 会 **transfer**（分离）传入的 ArrayBuffer，
 * 所以整个生命周期只能打开一次文档，之后复用返回的句柄。
 */

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type { PdfLine } from './pdf-lines';

/** 页面尺寸（scale = 1 时的 CSS 像素） */
export interface PageSize {
  width: number;
  height: number;
}

export interface PdfHandle {
  doc: PDFDocumentProxy;
  /** 全文（按行拼接） */
  text: string;
  lines: PdfLine[];
  /** 每行在 text 中的起始偏移，用于把发现位置映射回行 */
  lineStart: number[];
  pageCount: number;
  /** 每页尺寸：页面还没渲染时先按这个尺寸占位，滚动条从一开始就是准的 */
  pages: PageSize[];
  /** 是否为扫描件（无文本层） */
  scanned: boolean;
  destroy(): Promise<void>;
}

export type PdfErrorCode = 'password' | 'invalid' | 'unknown';

function errorName(err: unknown): unknown {
  return typeof err === 'object' && err ? (err as { name?: unknown }).name : undefined;
}

/** pdf.js 的异常从 worker 传回来，instanceof 不可靠，按 name 区分 */
export function pdfErrorCode(err: unknown): PdfErrorCode {
  const name = errorName(err);
  if (name === 'PasswordException') return 'password';
  if (name === 'InvalidPDFException') return 'invalid';
  return 'unknown';
}

export function isRenderCancelled(err: unknown): boolean {
  return errorName(err) === 'RenderingCancelledException';
}

/** 打开 PDF 并完成文本抽取与行重组；每解析完一页回调一次进度 */
export async function openPdf(
  data: ArrayBuffer,
  onProgress?: (done: number, total: number) => void,
): Promise<PdfHandle> {
  // 持有 loadingTask：pdf.js v6 里释放文档的正确入口是 loadingTask.destroy()
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });

  try {
    const doc = await loadingTask.promise;
    const lines: PdfLine[] = [];
    const pages: PageSize[] = [];
    let anyText = false;
    onProgress?.(0, doc.numPages);

    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      pages.push({ width: viewport.width, height: viewport.height });
      const content = await page.getTextContent();

      const raw: RawItem[] = [];
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        raw.push({
          str: item.str,
          x: item.transform[4] as number,
          y: item.transform[5] as number,
          width: item.width ?? 0,
          height: Math.abs((item.transform[3] as number) ?? 10),
        });
      }

      if (raw.length > 0) anyText = true;

      const rows = groupIntoRows(raw);
      const gutter = detectGutter(rows, viewport.width);
      lines.push(...rowsToLines(rows, p, viewport, gutter));
      onProgress?.(p, doc.numPages);
    }

    const { text, lineStart } = buildText(lines);

    return {
      doc,
      text,
      lines,
      lineStart,
      pageCount: doc.numPages,
      pages,
      scanned: !anyText,
      destroy: () => loadingTask.destroy(),
    };
  } catch (err) {
    void loadingTask.destroy();
    throw err;
  }
}

export interface RenderJob {
  promise: Promise<HTMLCanvasElement>;
  cancel(): void;
}

function cancelledError(): Error {
  const err = new Error('Rendering cancelled');
  err.name = 'RenderingCancelledException';
  return err;
}

/**
 * 把一页渲染到离屏画布。
 *
 * 先画在离屏画布上，画完再由调用方贴到可见画布：
 * 缩放时旧画面会先按 CSS 拉伸顶着，不会闪白。
 * pdf.js v6 只传 canvas（canvasContext 已废弃；两者同时传会导致渲染 promise 不 resolve）。
 */
export function renderPage(handle: PdfHandle, pageNumber: number, scale: number): RenderJob {
  let task: RenderTask | null = null;
  let cancelled = false;

  const promise = (async () => {
    const page = await handle.doc.getPage(pageNumber);
    if (cancelled) throw cancelledError();
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    task = page.render({ canvas, viewport });
    await task.promise;
    return canvas;
  })();

  return {
    promise,
    cancel() {
      cancelled = true;
      task?.cancel();
    },
  };
}
