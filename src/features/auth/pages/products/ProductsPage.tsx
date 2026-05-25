// P1 multi-business — Каталог (Products) is now template-aware.
//
// Changes vs the old clothing-hardcoded page:
//   - Header tabs let the manager switch вид деятельности (OrderTemplate).
//   - Catalog rows are filtered server-side by the active templateId.
//   - The legacy «Таблица цветов» section is gone; instead we render a generic
//     «Опции полей» block walking `template.sections.items.fields` looking for
//     select-typed fields with options.
//   - Cross-imported CSS (../warehouse/WarehouseCatalog.module.css) is gone;
//     all classes now live in ProductsPage.module.css.
//   - Manual add opens a schema-driven drawer (AddCatalogItemDrawer) that
//     attaches the active templateId + default retail/wholesale prices.
//   - The legacy «Поля товара» tab and seeded color/size/etc. import were
//     removed (the underlying server tables were dropped in P0).
//
// What stays in P2:
//   - «Скачать шаблон Excel» button is rendered but disabled with a tooltip
//     («Будет в P2») — wired up once the per-template template generator ships.

import { useMemo, useState } from 'react';
import {
  CheckCircle2, Plus, Trash2, ChevronDown, ChevronRight,
  Pencil, Check, X, Package, Image as ImageIcon, Boxes, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCatalogProducts,
  useDeleteProduct,
  useUpdateProduct,
  useProductPhotos,
  useUploadProductPhoto,
  useDeleteProductPhoto,
  warehouseKeys,
} from '@/entities/warehouse/queries';
import { productPhotosApi, warehouseCatalogApi } from '@/entities/warehouse/api';
import type { WarehouseProductCatalog } from '@/entities/warehouse/types';
import { useOrderTemplates, useActiveOrderTemplate } from '@/entities/order/templatesApi';
import type { OrderTemplate, OrderTemplateField } from '@/entities/order/templates';
import { getItemsSection } from '@/entities/order/templates';
import { SearchInput } from '@/shared/ui/SearchInput';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/Button';
import { Drawer } from '@/shared/ui/Drawer';
import { readApiErrorStatus, readApiErrorPayload, readApiErrorMessage } from '@/shared/api/errors';
import { AddCatalogItemDrawer } from './AddCatalogItemDrawer';
import styles from './ProductsPage.module.css';
import { useRef } from 'react';

// ── InlineEdit ─────────────────────────────────────────────────────────────────

function InlineEdit({ value, onSave, isPending }: {
  value: string; onSave: (v: string) => void; isPending?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = () => { setDraft(value); setEditing(true); setTimeout(() => inputRef.current?.select(), 0); };
  const cancel = () => setEditing(false);
  const save = () => { const v = draft.trim(); if (v && v !== value) onSave(v); setEditing(false); };

  if (editing) {
    return (
      <span className={styles.inlineEditRow} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef} className={styles.inlineInput} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') cancel(); }}
          autoFocus
          aria-label="Название позиции"
          placeholder="Название"
        />
        <button type="button" className={styles.inlineSave} title="Сохранить" aria-label="Сохранить" onClick={save} disabled={!draft.trim() || isPending}><Check size={11} /></button>
        <button type="button" className={styles.inlineCancel} title="Отмена" aria-label="Отмена" onClick={cancel}><X size={11} /></button>
      </span>
    );
  }

  return (
    <span className={styles.inlineViewRow}>
      <span>{value}</span>
      <button type="button" className={styles.inlinePencil} title="Редактировать название" aria-label="Редактировать название" onClick={(e) => { e.stopPropagation(); open(); }}><Pencil size={11} /></button>
    </span>
  );
}

// ── ProductPhotoSection ────────────────────────────────────────────────────────

function ProductPhotoSection({ productId }: { productId: string }) {
  const { data: photos = [] } = useProductPhotos(productId);
  const upload = useUploadProductPhoto(productId);
  const deletePhoto = useDeleteProductPhoto(productId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  return (
    <>
      <div className={styles.photoSection}>
        {photos.map((photo) => {
          const photoUrl = photo.fileUrl ?? productPhotosApi.fileUrl(productId, photo.id);
          return (
            <div key={photo.id} className={styles.photoThumb}>
              <img src={photoUrl} alt={photo.fileName} onClick={() => setLightboxSrc(photoUrl)} />
              <button
                type="button"
                className={styles.photoThumbDelete}
                title="Удалить фото"
                aria-label="Удалить фото"
                onClick={(e) => { e.stopPropagation(); deletePhoto.mutate(photo.id); }}
              >
                <Trash2 size={14} color="#fff" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className={styles.photoAddBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
          title="Загрузить фото"
        >
          <ImageIcon size={13} />
          <span>Фото</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={styles.hidden}
          aria-label="Загрузить фото товара"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = '';
          }}
        />
      </div>
      {lightboxSrc && (
        <div className={styles.lightboxBackdrop} onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} className={styles.lightboxImg} alt="Просмотр фото" onClick={(e) => e.stopPropagation()} />
          <button type="button" className={styles.lightboxClose} aria-label="Закрыть" onClick={() => setLightboxSrc(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}

// ── ProductRow ─────────────────────────────────────────────────────────────────

function ProductRow({ product }: { product: WarehouseProductCatalog }) {
  const [expanded, setExpanded] = useState(false);
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const retail = product.defaultRetailPrice ?? null;
  const wholesale = product.defaultWholesalePrice ?? null;

  return (
    <div className={styles.productRow}>
      <div className={styles.productHeader} onClick={() => setExpanded(!expanded)}>
        <span className={styles.productChevron}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <Package size={14} className={styles.productIcon} />
        <span className={styles.productName} onClick={(e) => e.stopPropagation()}>
          <InlineEdit
            value={product.name}
            onSave={(name) => updateProduct.mutate({ id: product.id, name })}
            isPending={updateProduct.isPending}
          />
        </span>

        {(retail !== null || wholesale !== null) && (
          <span className={styles.productMeta}>
            {retail !== null && (
              <span className={styles.productPriceBadge}>розн. {Math.round(retail)} ₸</span>
            )}
            {wholesale !== null && (
              <span className={styles.productPriceBadge}>опт. {Math.round(wholesale)} ₸</span>
            )}
          </span>
        )}

        <button
          type="button"
          className={styles.deleteBtn}
          title="Удалить позицию"
          aria-label="Удалить позицию"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Удалить позицию "${product.name}"?`)) {
              deleteProduct.mutate(product.id);
            }
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
      {expanded && (
        <div className={styles.productBody}>
          <ProductPhotoSection productId={product.id} />
        </div>
      )}
    </div>
  );
}

// ── FieldOptionsBlock (generic: replaces hardcoded «Таблица цветов») ──────────

function FieldOptionsBlock({ template }: { template: OrderTemplate }) {
  const items = getItemsSection(template);
  const selectFields = useMemo<OrderTemplateField[]>(
    () => (items?.fields ?? []).filter((f) => f.type === 'select' && (f.options?.length ?? 0) > 0),
    [items],
  );

  if (selectFields.length === 0) return null;

  return (
    <div className={styles.optionsBlock}>
      <div className={styles.optionsTitle}>
        Опции полей шаблона «{template.name}»
      </div>
      {selectFields.map((f) => (
        <div key={f.id} className={styles.optionsGroup}>
          <div className={styles.optionsGroupHeader}>
            {f.label}
            {f.affectsAvailability && (
              <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--fill-accent)' }} title="Влияет на остатки">
                · ось остатка
              </span>
            )}
          </div>
          <div className={styles.optionsChipRow}>
            {(f.options ?? []).map((opt) => (
              <span key={opt} className={styles.optionChip}>{opt}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

interface TemplateMismatchInfo {
  templateName: string;
  missingHeaders: string[];
  foundHeaders: string[];
}

function pluralizePositions(n: number): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'позиций';
  if (mod10 === 1) return 'позицию';
  if (mod10 >= 2 && mod10 <= 4) return 'позиции';
  return 'позиций';
}

export default function ProductsPage() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mismatch, setMismatch] = useState<TemplateMismatchInfo | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: templatesData, isLoading: templatesLoading } = useOrderTemplates();
  const templates: OrderTemplate[] = templatesData?.results ?? [];

  // Default: org's isDefault template (or first system) when no manual pick.
  const { data: activeTemplate } = useActiveOrderTemplate(selectedTemplateId);
  const effectiveTemplateId = activeTemplate?.id ?? null;

  // ── Download .xlsx template for the active вид деятельности ──────────────
  const handleDownloadTemplate = async () => {
    if (!activeTemplate || downloading) return;
    setDownloading(true);
    try {
      const blob = await warehouseCatalogApi.downloadTemplateExcel(activeTemplate.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `catalog-${activeTemplate.name}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Defer revoke so the browser has time to start the download.
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      toast.error(readApiErrorMessage(err, 'Не удалось скачать шаблон Excel'));
    } finally {
      setDownloading(false);
    }
  };

  // ── Import an .xlsx file against the active вид деятельности ─────────────
  const handleImportFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    // Reset the input synchronously so picking the same file twice works.
    event.target.value = '';
    if (!file || !activeTemplate || importing) return;

    setImporting(true);
    try {
      const result = await warehouseCatalogApi.importExcel(activeTemplate.id, file);
      toast.success(
        `Импортировано ${result.created} ${pluralizePositions(result.created)}` +
          (result.skipped > 0 ? ` · пропущено ${result.skipped}` : ''),
      );
      if (result.errors.length > 0) {
        toast.warning(`Ошибок при импорте: ${result.errors.length}`);
      }
      queryClient.invalidateQueries({ queryKey: warehouseKeys.catalog.products });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
    } catch (err) {
      const status = readApiErrorStatus(err);
      const payload = readApiErrorPayload(err) as
        | (TemplateMismatchInfo & { error?: string })
        | undefined;
      if (status === 422 && payload?.error === 'TEMPLATE_MISMATCH') {
        setMismatch({
          templateName: payload.templateName ?? activeTemplate.name,
          missingHeaders: payload.missingHeaders ?? [],
          foundHeaders: payload.foundHeaders ?? [],
        });
      } else {
        toast.error(readApiErrorMessage(err, 'Не удалось импортировать файл'));
      }
    } finally {
      setImporting(false);
    }
  };

  const { data: products = [], isLoading: productsLoading } =
    useCatalogProducts({ templateId: effectiveTemplateId });

  const q = search.trim().toLowerCase();
  const filteredProducts = q
    ? products.filter((p) => p.name.toLowerCase().includes(q))
    : products;

  const templateName = activeTemplate?.name ?? '—';

  return (
    <div className={styles.root}>
      {/* ── Page header ── */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Boxes size={18} />
          <span>Каталог</span>
        </div>
        <div className={styles.headerSub}>
          Позиции каталога с привязкой к виду деятельности
        </div>
      </div>

      {/* ── Template tabs (вид деятельности) ── */}
      {!templatesLoading && templates.length > 0 && (
        <div className={styles.templateTabs}>
          {templates.map((t) => {
            const isActive = effectiveTemplateId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={[
                  styles.templateTab,
                  isActive ? styles.templateTabActive : '',
                ].filter(Boolean).join(' ')}
                onClick={() => setSelectedTemplateId(t.id)}
                title={`Переключить вид деятельности: ${t.name}`}
              >
                <span>{t.name}</span>
                {t.isSystem && <span className={styles.templateSystemMark}>СИС</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Unified toolbar ── */}
      <div className={styles.toolbar}>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setAddOpen(true)}
          disabled={!activeTemplate}
        >
          <Plus size={14} />
          Добавить вручную
        </Button>

        <button
          type="button"
          className={styles.uploadBtn}
          disabled={!activeTemplate || downloading}
          onClick={handleDownloadTemplate}
          title={
            activeTemplate
              ? `Скачать Excel-шаблон для «${activeTemplate.name}»`
              : 'Сначала выберите вид деятельности'
          }
        >
          <Download size={13} />
          {downloading ? 'Готовим файл…' : 'Скачать шаблон Excel'}
        </button>

        <button
          type="button"
          className={styles.uploadBtn}
          disabled={!activeTemplate || importing}
          onClick={() => importInputRef.current?.click()}
          title={
            activeTemplate
              ? `Импортировать Excel в каталог «${activeTemplate.name}»`
              : 'Сначала выберите вид деятельности'
          }
        >
          <Download size={13} style={{ transform: 'rotate(180deg)' }} />
          {importing ? 'Импортируем…' : 'Импорт Excel'}
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className={styles.hidden}
          aria-label="Выбрать Excel-файл для импорта каталога"
          onChange={handleImportFileChange}
        />

        <div className={styles.toolbarSpacer} />

        <div className={styles.searchWrap}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Поиск по названию позиции…"
          />
        </div>
      </div>

      {/* ── Content ── */}
      <div className={styles.content}>
        {!activeTemplate && !templatesLoading && (
          <EmptyState
            icon={<Boxes size={40} />}
            title="Нет видов деятельности"
            description="Сначала создайте хотя бы один шаблон заказа."
          />
        )}

        {activeTemplate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FieldOptionsBlock template={activeTemplate} />

            {productsLoading && (
              <div className={styles.empty}>Загрузка позиций…</div>
            )}

            {!productsLoading && products.length === 0 && (
              <EmptyState
                icon={<Package size={40} />}
                title={`Каталог по виду деятельности «${templateName}» пуст`}
                description="Добавьте позиции вручную или загрузите Excel-таблицу (доступно в P2)."
                action={{ label: 'Добавить вручную', onClick: () => setAddOpen(true) }}
              />
            )}

            {!productsLoading && products.length > 0 && filteredProducts.length === 0 && (
              <div className={styles.empty}>По запросу «{search}» ничего не найдено</div>
            )}

            {filteredProducts.length > 0 && (
              <div className={styles.list}>
                {filteredProducts.map((p) => (
                  <ProductRow key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      {activeTemplate && (
        <div className={styles.statusBar}>
          <span><CheckCircle2 size={13} /> Позиций: {products.length}</span>
          <span><CheckCircle2 size={13} /> Шаблон: {templateName}</span>
        </div>
      )}

      {/* ── Add drawer ── */}
      {addOpen && activeTemplate && (
        <AddCatalogItemDrawer
          template={activeTemplate}
          onClose={() => setAddOpen(false)}
        />
      )}

      {/* ── Template-mismatch modal (P2 import) ── */}
      <Drawer
        open={mismatch !== null}
        onClose={() => setMismatch(null)}
        title="Файл не соответствует виду деятельности"
        size="sm"
        footer={
          <Button variant="primary" size="sm" onClick={() => setMismatch(null)}>
            Понятно
          </Button>
        }
      >
        {mismatch && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, lineHeight: 1.5 }}>
            <div>
              Загруженный файл не соответствует виду деятельности «{mismatch.templateName}».
            </div>
            {mismatch.missingHeaders.length > 0 && (
              <div>
                В файле отсутствуют колонки: <b>{mismatch.missingHeaders.join(', ')}</b>.
              </div>
            )}
            <div>Скачайте корректный шаблон по кнопке «Скачать шаблон Excel».</div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
