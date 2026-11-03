import { useEffect, useState } from 'react';
import { Button } from 'antd';
import { ArrowRightOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { browser } from 'wxt/browser';
import { openReviewTab } from '../../lib/tabs';
import { useI18n } from '../../ui/i18n';
import LanguageSwitch from '../../ui/LanguageSwitch';

export default function PopupApp() {
  const { t } = useI18n();
  const [opening, setOpening] = useState(false);
  const version = browser.runtime.getManifest().version;

  useEffect(() => {
    document.title = t.appFullName;
  }, [t]);

  const open = async () => {
    setOpening(true);
    try {
      await openReviewTab();
    } finally {
      window.close();
    }
  };

  return (
    <div className="cg-popup">
      <div className="cg-popup__head">
        <img src="/logo.svg" width={40} height={40} alt="" />
        <div className="cg-popup__brand">
          <strong>
            {t.appFullName}
            <span className="cg-popup__version">v{version}</span>
          </strong>
          <span className="cg-popup__tagline">{t.popupTagline}</span>
        </div>
      </div>

      <Button
        id="open-review"
        type="primary"
        size="large"
        block
        icon={<ArrowRightOutlined />}
        iconPlacement="end"
        loading={opening}
        onClick={() => void open()}
      >
        {t.openReview}
      </Button>

      <ol className="cg-steps">
        {t.steps.map((step, i) => (
          <li key={step}>
            <span className="cg-steps__n">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      <div className="cg-popup__foot">
        <span className="cg-popup__trust" title={t.popupFooter}>
          <SafetyCertificateOutlined />
          {t.popupFooter}
        </span>
        <LanguageSwitch />
      </div>
    </div>
  );
}
