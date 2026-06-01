import { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2, Plus, Trash2, ChevronDown, ChevronRight,
  Pencil, Check, X, Package, Image as ImageIcon, Boxes, Download,
  LayoutGrid, Layers, Settings2, Tag, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCatalogProducts,
  useCatalogDefinitions,
  useCreateDefinition,
  useUpdateDefinition,
  useDeleteDefinition,
  useAddFieldOption,
  useDeleteFieldOption,
  useDeleteProduct,
  useUpdateProduct,
  useProductPhotos,
  useUploadProductPhoto,
  useDeleteProductPhoto,
  warehouseKeys,
} from '@/entities/warehouse/queries';
import { productPhotosApi, warehouseCatalogApi } from '@/entities/warehouse/api';
import type {
  WarehouseProductCatalog,
  WarehouseFieldDefinition,
} from '@/entities/warehouse/types';
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

// ── CatalogSidePanel ───────────────────────────────────────────────────────────

function CatalogSidePanel({ template }: { template: OrderTemplate | undefined }) {
  const items = template ? getItemsSection(template) : null;
  const fields: OrderTemplateField[] = items?.fields ?? [];
  const axisFields = fields.filter((f) => f.affectsAvailability);
  const extraFields = fields.filter((f) => !f.affectsAvailability);

  if (!template) {
    return (
      <aside className={styles.sidePanel}>
        <div className={styles.sidePanelEmpty}>Выберите вид деятельности</div>
      </aside>
    );
  }

  return (
    <aside className={styles.sidePanel}>
      <div className={styles.sidePanelSection}>
        <div className={styles.sidePanelLabel}>Вид деятельности</div>
        <div className={styles.sidePanelTitle}>{template.name}</div>
      </div>

      {axisFields.length > 0 && (
        <div className={styles.sidePanelSection}>
          <div className={styles.sidePanelLabel}>
            <Tag size={10} /> Оси остатка ({axisFields.length})
          </div>
          <div className={styles.sidePanelFieldList}>
            {axisFields.map((f) => (
              <div key={f.id} className={styles.sidePanelField}>
                <span className={styles.sidePanelFieldName}>{f.label}</span>
                <span className={styles.sidePanelFieldAxis}>ось</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {extraFields.length > 0 && (
        <div className={styles.sidePanelSection}>
          <div className={styles.sidePanelLabel}>
            <Layers size={10} /> Доп. поля ({extraFields.length})
          </div>
          <div className={styles.sidePanelFieldList}>
            {extraFields.map((f) => (
              <div key={f.id} className={styles.sidePanelField}>
                <span className={styles.sidePanelFieldName}>{f.label}</span>
                <span className={styles.sidePanelFieldType}>{f.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.sidePanelFooter}>
        <span>{fields.length} полей · {axisFields.length} осей</span>
      </div>
    </aside>
  );
}

// ── CatalogTemplateSettings ────────────────────────────────────────────────────

function CatalogTemplateSettings() {
  const { data: defs = [], isLoading } = useCatalogDefinitions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const createDef = useCreateDefinition();
  const updateDef = useUpdateDefinition();
  const deleteDef = useDeleteDefinition();
  const addOption = useAddFieldOption();
  const deleteOption = useDeleteFieldOption();
  const [newLabel, setNewLabel] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newOptionValue, setNewOptionValue] = useState('');

  const selected = defs.find((d) => d.id === selectedId) ?? defs[0] ?? null;

  const handleCreate = async () => {
    if (!newLabel.trim() || !newCode.trim()) return;
    const def = await createDef.mutateAsync({
      label: newLabel.trim(),
      code: newCode.trim().toLowerCase().replace(/\s+/g, '_'),
      inputType: 'select',
      isVariantAxis: false,
      showInWarehouseForm: true,
      showInOrderForm: true,
      affectsAvailability: false,
      sortOrder: defs.length,
    });
    setSelectedId(def.id);
    setNewLabel('');
    setNewCode('');
  };

  const handleToggleAxis = (def: WarehouseFieldDefinition) => {
    updateDef.mutate({ id: def.id, data: { affectsAvailability: !def.affectsAvailability } });
  };

  const handleAddOption = async () => {
    if (!selected || !newOptionValue.trim()) return;
    await addOption.mutateAsync({ defId: selected.id, value: newOptionValue.trim(), label: newOptionValue.trim() });
    setNewOptionValue('');
  };

  if (isLoading) {
    return <div className={styles.empty}>Загрузка полей…</div>;
  }

  return (
    <div className={styles.tplSettings}>
      {/* Left: field list */}
      <div className={styles.tplList}>
        <div className={styles.tplListHead}>
          <span>Поля каталога</span>
          <span className={styles.tplListCount}>{defs.length}</span>
        </div>
        <div className={styles.tplListItems}>
          {defs.map((def) => (
            <button
              key={def.id}
              type="button"
              className={[styles.tplListItem, def.id === (selected?.id) ? styles.tplListItemActive : ''].join(' ')}
              onClick={() => setSelectedId(def.id)}
            >
              <span className={styles.tplListItemLabel}>{def.label}</span>
              {def.affectsAvailability && (
                <span className={styles.tplListItemAxis}>ось</span>
              )}
            </button>
          ))}
        </div>

        <div className={styles.tplAddRow}>
          <input
            className={styles.tplInput}
            placeholder="Название поля"
            value={newLabel}
            onChange={(e) => { setNewLabel(e.target.value); if (!newCode) setNewCode(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')); }}
            aria-label="Название нового поля"
          />
          <input
            className={`${styles.tplInput} ${styles.tplInputMono}`}
            placeholder="код_поля"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            aria-label="Код нового поля"
          />
          <button
            type="button"
            className={styles.tplAddBtn}
            onClick={handleCreate}
            disabled={!newLabel.trim() || !newCode.trim() || createDef.isPending}
            aria-label="Создать поле"
            title="Создать поле"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Right: field editor */}
      {selected ? (
        <div className={styles.tplEditor}>
          <div className={styles.tplEditorHead}>
            <div>
              <div className={styles.tplEditorTitle}>{selected.label}</div>
              <div className={styles.tplEditorCode}>{selected.code}</div>
            </div>
            <button
              type="button"
              className={styles.tplDeleteBtn}
              onClick={() => { if (confirm(`Удалить поле «${selected.label}»?`)) deleteDef.mutate(selected.id); }}
              title="Удалить поле"
            >
              <Trash2 size={13} />
            </button>
          </div>

          <div className={styles.tplEditorRow}>
            <button
              type="button"
              className={[styles.tplToggle, selected.affectsAvailability ? styles.tplToggleOn : ''].join(' ')}
              onClick={() => handleToggleAxis(selected)}
              title={selected.affectsAvailability ? 'Снять признак «Ось остатка»' : 'Назначить как «Ось остатка»'}
            >
              {selected.affectsAvailability ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              Ось остатка
            </button>
            <span className={styles.tplToggleHint}>
              Влияет на складской учёт — каждое значение порождает отдельный вариант
            </span>
          </div>

          {selected.inputType === 'select' && (
            <div className={styles.tplOptionsSection}>
              <div className={styles.tplOptionsSectionHead}>
                <Settings2 size={12} />
                Варианты значений ({selected.options.length})
              </div>
              <div className={styles.tplOptionsList}>
                {selected.options.map((opt) => (
                  <div key={opt.id} className={styles.tplOptionItem}>
                    <span className={styles.tplOptionLabel}>{opt.label}</span>
                    <button
                      type="button"
                      className={styles.tplOptionDelete}
                      onClick={() => deleteOption.mutate({ defId: selected.id, optId: opt.id })}
                      aria-label={`Удалить вариант ${opt.label}`}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
              <div className={styles.tplAddOptionRow}>
                <input
                  className={styles.tplInput}
                  placeholder="Добавить значение…"
                  value={newOptionValue}
                  onChange={(e) => setNewOptionValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddOption(); }}
                  aria-label="Новое значение варианта"
                />
                <button
                  type="button"
                  className={styles.tplAddBtn}
                  onClick={handleAddOption}
                  disabled={!newOptionValue.trim() || addOption.isPending}
                  aria-label="Добавить значение"
                  title="Добавить значение"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.tplEditorEmpty}>
          <Layers size={32} className={styles.tplEditorEmptyIcon} />
          <span>Выберите поле для редактирования</span>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [pageMode, setPageMode] = useState<'products' | 'templates'>('products');
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
  const { data: activeTemplate } = useActiveOrderTemplate(selectedTemplateId);
  const effectiveTemplateId = activeTemplate?.id ?? null;

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
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      toast.error(readApiErrorMessage(err, 'Не удалось скачать шаблон Excel'));
    } finally {
      setDownloading(false);
    }
  };

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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
      {/* ── Page head ── */}
      <div className={styles.pageHead}>
        <div className={styles.pageHeadLeft}>
          <Boxes size={16} className={styles.pageHeadIcon} />
          <span className={styles.pageHeadTitle}>Каталог</span>
        </div>

        <div className={styles.segControl}>
          <button
            type="button"
            className={[styles.segBtn, pageMode === 'products' ? styles.segBtnActive : ''].join(' ')}
            onClick={() => setPageMode('products')}
          >
            <LayoutGrid size={13} />
            Позиции
          </button>
          <button
            type="button"
            className={[styles.segBtn, pageMode === 'templates' ? styles.segBtnActive : ''].join(' ')}
            onClick={() => setPageMode('templates')}
          >
            <Settings2 size={13} />
            Шаблоны
          </button>
        </div>

        {pageMode === 'products' && (
          <div className={styles.pageHeadActions}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setAddOpen(true)}
              disabled={!activeTemplate}
            >
              <Plus size={14} />
              Добавить
            </Button>

            <button
              type="button"
              className={styles.uploadBtn}
              disabled={!activeTemplate || downloading}
              onClick={handleDownloadTemplate}
              title={activeTemplate ? `Скачать Excel-шаблон для «${activeTemplate.name}»` : 'Сначала выберите вид деятельности'}
            >
              <Download size={13} />
              {downloading ? 'Готовим…' : 'Excel-шаблон'}
            </button>

            <button
              type="button"
              className={styles.uploadBtn}
              disabled={!activeTemplate || importing}
              onClick={() => importInputRef.current?.click()}
              title={activeTemplate ? `Импортировать Excel в каталог «${activeTemplate.name}»` : 'Сначала выберите вид деятельности'}
            >
              <Download size={13} style={{ transform: 'rotate(180deg)' }} />
              {importing ? 'Импортируем…' : 'Импорт'}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className={styles.hidden}
              aria-label="Выбрать Excel-файл для импорта каталога"
              onChange={handleImportFileChange}
            />
          </div>
        )}
      </div>

      {/* ── Template tabs — only in products mode ── */}
      {pageMode === 'products' && !templatesLoading && templates.length > 0 && (
        <div className={styles.templateTabs}>
          {templates.map((t) => {
            const isActive = effectiveTemplateId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={[styles.templateTab, isActive ? styles.templateTabActive : ''].join(' ')}
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

      {/* ── Toolbar — search, only in products mode ── */}
      {pageMode === 'products' && (
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Поиск по названию позиции…"
            />
          </div>
          {activeTemplate && (
            <span className={styles.toolbarCount}>
              {products.length} позиц.
            </span>
          )}
        </div>
      )}

      {/* ── Content — conditional on mode ── */}
      {pageMode === 'products' ? (
        <div className={styles.catLayout}>
          <div className={styles.catMain}>
            {!activeTemplate && !templatesLoading && (
              <EmptyState
                icon={<Boxes size={40} />}
                title="Нет видов деятельности"
                description="Сначала создайте хотя бы один шаблон заказа."
              />
            )}

            {activeTemplate && (
              <div className={styles.list}>
                {productsLoading && (
                  <div className={styles.empty}>Загрузка позиций…</div>
                )}

                {!productsLoading && products.length === 0 && (
                  <EmptyState
                    icon={<Package size={40} />}
                    title={`Каталог «${templateName}» пуст`}
                    description="Добавьте позиции вручную или загрузите Excel-таблицу."
                    action={{ label: 'Добавить вручную', onClick: () => setAddOpen(true) }}
                  />
                )}

                {!productsLoading && products.length > 0 && filteredProducts.length === 0 && (
                  <div className={styles.empty}>По запросу «{search}» ничего не найдено</div>
                )}

                {filteredProducts.map((p) => (
                  <ProductRow key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>

          <CatalogSidePanel template={activeTemplate} />
        </div>
      ) : (
        <div className={styles.content}>
          <CatalogTemplateSettings />
        </div>
      )}

      {/* ── Status bar — products mode only ── */}
      {pageMode === 'products' && activeTemplate && (
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

      {/* ── Template-mismatch modal ── */}
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
          <div className={styles.mismatchBody}>
            <div>
              Загруженный файл не соответствует виду деятельности «{mismatch.templateName}».
            </div>
            {mismatch.missingHeaders.length > 0 && (
              <div>
                В файле отсутствуют колонки: <b>{mismatch.missingHeaders.join(', ')}</b>.
              </div>
            )}
            <div>Скачайте корректный шаблон по кнопке «Excel-шаблон».</div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
