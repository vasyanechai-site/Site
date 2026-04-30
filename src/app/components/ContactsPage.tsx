import { useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Footer } from './Footer';
import { ArrowLeft, X, Download, Loader2 } from 'lucide-react';

const REQUISITES_PDF_DOWNLOAD =
  'https://www.dropbox.com/scl/fi/bx4mcpvm5pieiuj9ufv16/_-_-_-_-_.pdf?rlkey=tju1w7g9dum9w8ysuwcouriyg&st=keevsav1&dl=1';

// Google Docs Viewer даёт надёжный кросс-браузерный превью PDF
const REQUISITES_PDF_PREVIEW =
  'https://docs.google.com/viewer?url=' +
  encodeURIComponent(REQUISITES_PDF_DOWNLOAD) +
  '&embedded=true';

export function ContactsPage() {
  const navigate = useNavigate();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Блокируем скролл фона когда модалка открыта
  useEffect(() => {
    if (previewOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setIframeLoaded(false);
    }
    return () => { document.body.style.overflow = ''; };
  }, [previewOpen]);

  return (
    <div className="min-h-screen bg-[#FFF4E5] flex flex-col">
      <div className="container mx-auto px-4 py-8 flex-1 max-w-2xl">
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="pl-0 hover:pl-2 transition-all text-[#222222]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>
        </div>

        <h1 className="text-3xl font-normal text-[#222222] mb-10">Контакты</h1>

        {/* Режим работы */}
        <section className="mb-10">
          <h2 className="text-lg font-medium text-[#222222] mb-3">Режим работы</h2>
          <p className="text-[#222222]/70 text-sm">Пн–пт с 11:00 до 19:00</p>
        </section>

        {/* Реквизиты */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-[#222222]">Реквизиты</h2>
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              className="text-sm bg-[#FF90A1] border-[#FF90A1] text-[#222222] hover:bg-[#ff7a8e] hover:border-[#ff7a8e] hover:text-[#222222] transition-colors rounded-full px-5 py-2 h-auto font-normal"
            >
              Скачать реквизиты
            </Button>
          </div>

          <div className="flex flex-col gap-5">
            <ReqRow label="Наименование" value="Индивидуальный предприниматель Порохина Анастасия Игоревна" />
            <ReqRow label="ИНН" value="591000733530" />
            <ReqRow label="ОГРНИП" value="322470400099621" />
            <ReqRow label="Расчётный счёт" value="40802810901500399057" />
            <ReqRow label="Наименование банка" value='ООО «Банк Точка»' />
            <ReqRow label="БИК банка" value="044525104" />
            <ReqRow label="ИНН банка" value="9721194461" />
            <ReqRow label="Корреспондентский счёт" value="30101810745374525104" />
            <ReqRow
              label="Юридический адрес банка"
              value="109044, Российская Федерация, г. Москва, вн.тер.г. муниципальный округ Южнопортовый, пер. 3-й Крутицкий, д.11, помещ. 7Н."
            />
          </div>
        </section>
      </div>

      <Footer className="bg-[#FFF4E5] border-[#222222]/10" />

      {/* PDF Preview Modal */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: 'rgba(0,0,0,0.72)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewOpen(false); }}
        >
          <div
            className="relative flex flex-col bg-white w-full h-full md:m-auto md:rounded-2xl md:max-w-3xl md:max-h-[90vh] md:h-[90vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#222222]/10 shrink-0">
              <span className="text-[#222222] font-medium text-base">Реквизиты ИП Порохиной А.И.</span>
              <div className="flex items-center gap-2">
                <a
                  href={REQUISITES_PDF_DOWNLOAD}
                  download="Реквизиты_Кофе_Нечай.pdf"
                  className="inline-flex items-center gap-1.5 bg-[#FF90A1] hover:bg-[#ff7a8e] text-[#222222] text-sm font-normal rounded-full px-4 py-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Скачать PDF
                </a>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#222222]/8 transition-colors"
                  aria-label="Закрыть"
                >
                  <X className="w-4 h-4 text-[#222222]/60" />
                </button>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="relative flex-1 bg-[#f5f5f5]">
              {/* Loading state */}
              {!iframeLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                  <Loader2 className="w-8 h-8 animate-spin text-[#FF90A1]" />
                  <p className="text-sm text-[#222222]/50">Загружаем превью…</p>
                </div>
              )}
              <iframe
                key={REQUISITES_PDF_PREVIEW}
                src={REQUISITES_PDF_PREVIEW}
                title="Реквизиты PDF"
                onLoad={() => setIframeLoaded(true)}
                className="w-full h-full border-0"
                style={{ opacity: iframeLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReqRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[#222222]/10 pb-5">
      <p className="text-xs text-[#222222]/50 mb-1">{label}</p>
      <p className="text-sm text-[#222222] leading-relaxed">{value}</p>
    </div>
  );
}