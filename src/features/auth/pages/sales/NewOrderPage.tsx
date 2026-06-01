// ЧАСТЬ X / P2 — new-order form host. All logic lives in useNewOrderFormState;
// each section is its own block component reading the form context. P2b: the
// visible block set + their order are config-driven (applyNewOrderConfig);
// the default config reproduces today's form exactly.

import { useNewOrderFormState } from './new-order/useNewOrderFormState';
import { NewOrderFormProvider } from './new-order/NewOrderFormContext';
import { NEW_ORDER_BLOCKS } from './new-order/registry';
import { applyNewOrderConfig } from '@/shared/composition/applyNewOrderConfig';
import { useTenantConfig } from '@/shared/composition/useTenantConfig';
import styles from './NewOrderPage.module.css';

// Re-exported for back-compat: NewOrderDraft.test.ts imports it from here.
export { sanitizeDraft } from './new-order/formModel';

export default function NewOrderPage() {
  const state = useNewOrderFormState();
  const {
    isWholesale, draftRestored, resetDraftState,
    handleSubmit, onSubmit, onValidationError,
    navigate, isSubmitting, createOrder, hasIncompleteVariantLines,
    selectedTemplateId, setSelectedTemplateId,
  } = state;

  const tenantConfig = useTenantConfig();
  const blockIds = applyNewOrderConfig(tenantConfig?.data ?? null);

  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{isWholesale ? 'Новый оптовый заказ' : 'Новый заказ'}</h1>
        <div className={styles.pageHeaderRight} />
      </div>

      {draftRestored && (
        <div className={styles.draftBanner}>
          <span>Восстановлен незавершённый черновик</span>
          <button
            type="button"
            className={styles.draftClear}
            onClick={() => {
              resetDraftState();
            }}
          >
            Сбросить
          </button>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit(onSubmit, onValidationError)}>
        <NewOrderFormProvider value={state}>
          {blockIds.map((id) => {
            const Block = NEW_ORDER_BLOCKS[id];
            return Block ? <Block key={id} /> : null;
          })}
        </NewOrderFormProvider>

        <div className={styles.formActions}>
          <button type="button" className={styles.cancelBtn} onClick={() => navigate('/sales')}>
            Отмена
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting || createOrder.isPending}
            title={hasIncompleteVariantLines ? 'У позиций каталога не заполнены атрибуты — нажмите, чтобы увидеть подсказку' : undefined}
          >
            {createOrder.isPending ? 'Создание...' : 'Создать заказ'}
          </button>
        </div>
      </form>
    </div>
  );
}
