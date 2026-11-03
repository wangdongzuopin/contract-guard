import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { App as AntApp } from 'antd';
import { browser } from 'wxt/browser';
import { analyzeDocument, type Report } from '@cg/core';
import { downloadHtml, reportFileName, reportToHtml } from '../../lib/export';
import { findingKey, locateFindings, type HighlightRect } from '../../lib/findings';
import { openPdf, pdfErrorCode, type PdfHandle } from '../../lib/pdf';
import { isEditableTarget, yieldToPaint } from '../../ui/dom';
import { useI18n } from '../../ui/i18n';
import DropOverlay from './components/DropOverlay';
import EmptyState from './components/EmptyState';
import Header from './components/Header';
import LoadingState from './components/LoadingState';
import PdfViewer from './components/PdfViewer';
import Sidebar from './components/Sidebar';
import type { LoadError, LoadProgress, Selection, SeverityFilter } from './types';

interface LoadedDoc {
  fileName: string;
  handle: PdfHandle;
  /** 打开文件时用当时的语言生成的报告；切换语言时按需重算 */
  report: Report;
  durationMs: number;
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function errorDetail(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default function ReviewApp() {
  const { t, locale } = useI18n();
  const { message } = AntApp.useApp();
  const [doc, setDoc] = useState<LoadedDoc | null>(null);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  /** 每次打开文件 +1；异步步骤结束时序号对不上，说明用户已经换了文件 */
  const loadSeq = useRef(0);
  /** 当前文档句柄 —— 换文件或关闭时释放 worker 与内存 */
  const liveHandle = useRef<PdfHandle | null>(null);

  // 切换语言只重算文案；判定结果不变，所以选中项按 key 保留
  const report = useMemo(() => {
    if (!doc) return null;
    if (doc.report.meta.locale === locale) return doc.report;
    return analyzeDocument(doc.handle.text, {
      fileName: doc.fileName,
      pageCount: doc.handle.pageCount,
      durationMs: doc.durationMs,
      locale,
    }).report;
  }, [doc, locale]);

  // 位置与语言无关，只随文档变化
  const locations = useMemo<Map<string, HighlightRect[]>>(
    () => (doc ? locateFindings(doc.handle, doc.report.findings) : new Map()),
    [doc],
  );

  const visible = useMemo(() => {
    if (!report) return [];
    return filter === 'all' ? report.findings : report.findings.filter((f) => f.severity === filter);
  }, [report, filter]);

  useEffect(() => {
    document.title = doc ? `${doc.fileName} · ${t.appName}` : t.appName;
  }, [doc, t]);

  /** 有文档时用轻提示，不打断阅读；没有文档时把错误放在拖放区上方 */
  const fail = useCallback(
    (err: LoadError) => {
      if (liveHandle.current) {
        const copy = t.errors[err.code];
        void message.error(`${copy.title}${t.colon}${copy.desc}`);
      } else {
        setError(err);
      }
    },
    [message, t],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!isPdf(file)) {
        fail({ code: 'notPdf' });
        return;
      }

      const id = ++loadSeq.current;
      const started = performance.now();
      setError(null);
      setProgress({ fileName: file.name, stage: 'read', done: 0, total: 0 });
      let handle: PdfHandle | null = null;

      try {
        const data = await file.arrayBuffer();
        if (id !== loadSeq.current) return;

        handle = await openPdf(data, (done, total) => {
          if (id === loadSeq.current) setProgress({ fileName: file.name, stage: 'parse', done, total });
        });
        if (id !== loadSeq.current) {
          void handle.destroy();
          return;
        }
        if (handle.scanned || handle.text.trim().length < 50) {
          void handle.destroy();
          fail({ code: 'scanned' });
          return;
        }

        setProgress({ fileName: file.name, stage: 'analyze', done: handle.pageCount, total: handle.pageCount });
        await yieldToPaint();
        if (id !== loadSeq.current) {
          void handle.destroy();
          return;
        }

        const result = analyzeDocument(handle.text, { fileName: file.name, pageCount: handle.pageCount, locale });
        const durationMs = Math.round(performance.now() - started);
        result.report.meta.durationMs = durationMs;

        const previous = liveHandle.current;
        liveHandle.current = handle;
        if (previous) void previous.destroy();

        setDoc({ fileName: file.name, handle, report: result.report, durationMs });
        setSelection(null);
        setFilter('all');
      } catch (err) {
        if (handle && handle !== liveHandle.current) void handle.destroy();
        if (id !== loadSeq.current) return;
        console.error('[contract-guard] 打开文件失败', err);
        const code = pdfErrorCode(err);
        fail(code === 'unknown' ? { code, detail: errorDetail(err) } : { code });
      } finally {
        if (id === loadSeq.current) setProgress(null);
      }
    },
    [fail, locale],
  );

  const pickFile = useCallback(() => inputRef.current?.click(), []);

  const openSample = useCallback(async () => {
    try {
      const res = await fetch(browser.runtime.getURL('/sample-contract.pdf'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      await handleFile(new File([blob], t.sampleFileName, { type: 'application/pdf' }));
    } catch (err) {
      fail({ code: 'unknown', detail: errorDetail(err) });
    }
  }, [fail, handleFile, t]);

  const closeFile = useCallback(() => {
    loadSeq.current += 1;
    const previous = liveHandle.current;
    liveHandle.current = null;
    setDoc(null);
    setSelection(null);
    setProgress(null);
    setFilter('all');
    if (previous) void previous.destroy();
  }, []);

  const exportReport = useCallback(() => {
    if (!report) return;
    downloadHtml(reportFileName(report, locale), reportToHtml(report, locale));
    void message.success(t.exported);
  }, [locale, message, report, t]);

  const changeFilter = useCallback(
    (next: SeverityFilter) => {
      setFilter(next);
      // 选中项被筛掉时一并取消，免得 PDF 上留着一个看不到来源的选中框
      setSelection((sel) => {
        if (!sel || next === 'all' || !report) return sel;
        const f = report.findings.find((x) => findingKey(x) === sel.key);
        return f?.severity === next ? sel : null;
      });
    },
    [report],
  );

  const selectFromList = useCallback((key: string) => setSelection({ key, origin: 'list' }), []);
  const selectFromViewer = useCallback((key: string) => setSelection({ key, origin: 'viewer' }), []);

  // 快捷键：Ctrl/⌘ + O 打开文件，Esc 取消选中
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        inputRef.current?.click();
        return;
      }
      if (e.key === 'Escape' && !isEditableTarget(e.target)) setSelection(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 文件拖进窗口任何位置都能打开，不只限于拖放区
  const handleFileRef = useRef(handleFile);
  useEffect(() => {
    handleFileRef.current = handleFile;
  }, [handleFile]);

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) void handleFileRef.current(file);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  let body: ReactNode;
  if (progress) {
    body = <LoadingState progress={progress} />;
  } else if (doc && report) {
    body = (
      <div className="cg-workspace">
        <Sidebar
          report={report}
          findings={visible}
          filter={filter}
          onFilterChange={changeFilter}
          selectedKey={selection?.key ?? null}
          onSelect={selectFromList}
          locations={locations}
        />
        <PdfViewer
          handle={doc.handle}
          findings={visible}
          locations={locations}
          selection={selection}
          onSelect={selectFromViewer}
        />
      </div>
    );
  } else {
    body = (
      <EmptyState error={error} onDismissError={() => setError(null)} onPick={pickFile} onSample={() => void openSample()} />
    );
  }

  return (
    <div className="cg-shell">
      <Header
        file={doc ? { fileName: doc.fileName, pageCount: doc.handle.pageCount, durationMs: doc.durationMs } : null}
        canExport={!!report && !progress}
        onOpen={pickFile}
        onClose={closeFile}
        onExport={exportReport}
      />
      <main className="cg-main">{body}</main>
      <DropOverlay visible={dragging} replacing={!!doc} />
      <input
        ref={inputRef}
        id="file"
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
