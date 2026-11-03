import { FilePdfOutlined } from '@ant-design/icons';
import { cx } from '../../../ui/dom';
import { useI18n } from '../../../ui/i18n';

/** 文件拖进窗口任何位置都会出现；不拦截鼠标事件，拖放由 App 在 window 上统一处理 */
export default function DropOverlay({ visible, replacing }: { visible: boolean; replacing: boolean }) {
  const { t } = useI18n();
  return (
    <div id="drop-overlay" className={cx('cg-drop', visible && 'is-visible')} aria-hidden={!visible}>
      <div className="cg-drop__card">
        <FilePdfOutlined className="cg-drop__icon" />
        <strong>{t.dropOverlay}</strong>
        {replacing && <span className="cg-drop__hint">{t.dropOverlayReplace}</span>}
      </div>
    </div>
  );
}
