import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Factory,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RadioTower,
  Trash2,
  Truck,
  Wind,
} from 'lucide-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { chapanApi, FABRIC_CATALOG, PRODUCT_CATALOG, SIZE_OPTIONS, type ClientRequest, type WorkzoneProfile } from './chapanApi';
import styles from './WorkzoneRequest.module.css';

interface DraftItem {
  key: string;
  productName: string;
  fabricPreference: string;
  size: string;
  quantity: number;
  notes: string;
}

const DELIVERY_OPTIONS = [
  'Самовывоз',
  'Курьер по городу',
  'Доставка по Казахстану',
  'Нужна консультация',
] as const;

const LEAD_SOURCE_OPTIONS = [
  'Instagram',
  'TikTok',
  'WhatsApp',
  'Сайт',
  'Рекомендация',
] as const;

const CALENDAR_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const SUCCESS_VIDEO_SRC = '/media/request-success-mist.mp4';

const DEFAULT_PROFILE: WorkzoneProfile = {
  displayName: 'Чапан',
  descriptor: '',
  orderPrefix: 'ЧП',
  publicIntakeTitle: 'Заявка на пошив',
  publicIntakeDescription: '',
  publicIntakeEnabled: true,
  supportLabel: '',
};

function buildItem(
  productCatalog: readonly string[],
  fabricCatalog: readonly string[],
  sizeCatalog: readonly string[],
): DraftItem {
  return {
    key: crypto.randomUUID(),
    productName: productCatalog[0] ?? PRODUCT_CATALOG[0],
    fabricPreference: fabricCatalog[0] ?? FABRIC_CATALOG[0],
    size: sizeCatalog[3] ?? sizeCatalog[0] ?? SIZE_OPTIONS[0],
    quantity: 1,
    notes: '',
  };
}

function normalizePhoneDigits(value: string) {
  const digits = value.replace(/\D/g, '');
  const withoutPrefix = digits.startsWith('7') ? digits.slice(1) : digits.replace(/^8/, '');
  return withoutPrefix.slice(0, 10);
}

function formatKazakhPhone(value: string) {
  const local = normalizePhoneDigits(value);

  if (!local.length) return '+7';

  const area = local.slice(0, 3);
  const base = local.slice(3, 6);
  const pairOne = local.slice(6, 8);
  const pairTwo = local.slice(8, 10);

  let result = '+7';

  if (area) {
    result += `(${area}`;
    if (area.length === 3) result += ')';
  }

  if (base) result += base;
  if (pairOne) result += `-${pairOne}`;
  if (pairTwo) result += `-${pairTwo}`;

  return result;
}

function messengerLabel(type: 'phone' | 'whatsapp' | 'telegram') {
  if (type === 'whatsapp') return 'WhatsApp';
  if (type === 'telegram') return 'Telegram';
  return 'Звонок';
}

function buildCalendarDays(month: Date) {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
}

export default function WorkzoneRequestPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState<ClientRequest | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [profile, setProfile] = useState<WorkzoneProfile>(DEFAULT_PROFILE);
  const [productCatalog, setProductCatalog] = useState<string[]>([...PRODUCT_CATALOG]);
  const [fabricCatalog, setFabricCatalog] = useState<string[]>([...FABRIC_CATALOG]);
  const [sizeCatalog, setSizeCatalog] = useState<string[]>([...SIZE_OPTIONS]);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('+7');
  const [hasWhatsApp, setHasWhatsApp] = useState(false);
  const [hasTelegram, setHasTelegram] = useState(false);
  const [preferredContact, setPreferredContact] = useState<'phone' | 'whatsapp' | 'telegram'>('phone');
  const [city, setCity] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [desiredDate, setDesiredDate] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([
    buildItem(PRODUCT_CATALOG, FABRIC_CATALOG, SIZE_OPTIONS),
  ]);
  const calendarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [nextProfile, settings] = await Promise.all([
        chapanApi.getProfile(),
        chapanApi.getCatalogs(),
      ]);

      if (cancelled) return;

      setProfile(nextProfile);
      setProductCatalog(settings.productCatalog);
      setFabricCatalog(settings.fabricCatalog);
      setSizeCatalog(settings.sizeCatalog);
      setItems([buildItem(settings.productCatalog, settings.fabricCatalog, settings.sizeCatalog)]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!submitted) return;
    setVideoReady(false);
  }, [submitted]);

  useEffect(() => {
    if (preferredContact === 'whatsapp' && !hasWhatsApp) {
      setPreferredContact(hasTelegram ? 'telegram' : 'phone');
    }

    if (preferredContact === 'telegram' && !hasTelegram) {
      setPreferredContact(hasWhatsApp ? 'whatsapp' : 'phone');
    }
  }, [hasTelegram, hasWhatsApp, preferredContact]);

  useEffect(() => {
    if (!calendarOpen) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (!calendarRef.current?.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [calendarOpen]);

  useEffect(() => {
    if (!desiredDate) return;
    setCalendarMonth(parseISO(desiredDate));
  }, [desiredDate]);

  const phoneDigits = normalizePhoneDigits(phone);
  const selectedDate = desiredDate ? parseISO(desiredDate) : null;
  const calendarDays = buildCalendarDays(calendarMonth);
  const canSubmit = (
    customerName.trim().length > 1
    && phoneDigits.length === 10
    && city.trim().length > 1
    && deliveryMethod.trim().length > 0
    && items.every((item) => item.productName.trim() && item.quantity > 0)
  );

  const resetForm = () => {
    setCustomerName('');
    setPhone('+7');
    setHasWhatsApp(false);
    setHasTelegram(false);
    setPreferredContact('phone');
    setCity('');
    setDeliveryMethod('');
    setLeadSource('');
    setDesiredDate('');
    setCalendarOpen(false);
    setCalendarMonth(new Date());
    setNotes('');
    setItems([buildItem(productCatalog, fabricCatalog, sizeCatalog)]);
  };

  const submit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);

    const messengers: Array<'whatsapp' | 'telegram'> = [];
    if (hasWhatsApp) messengers.push('whatsapp');
    if (hasTelegram) messengers.push('telegram');

    const result = await chapanApi.submitClientRequest({
      customerName,
      phone,
      messengers,
      city,
      deliveryMethod,
      leadSource: leadSource || undefined,
      preferredContact,
      desiredDate: desiredDate || undefined,
      notes: notes || undefined,
      items: items.map((item) => ({
        productName: item.productName,
        fabricPreference: item.fabricPreference || undefined,
        size: item.size || undefined,
        quantity: item.quantity,
        notes: item.notes || undefined,
      })),
    });

    setSubmitted(result);
    resetForm();
    setSaving(false);
  };

  const closeWindow = () => {
    window.close();
  };

  const handleSuccessVideoReady = () => {
    window.setTimeout(() => {
      setVideoReady(true);
    }, 180);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Factory size={18} />
        <span>Подготавливаю форму заявки...</span>
      </div>
    );
  }

  if (!profile.publicIntakeEnabled) {
    return (
      <div className={styles.loading}>
        <span>Форма заявки временно отключена.</span>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.backdropOrb} />
      <div className={styles.backdropGrid} />

      <main className={styles.shell}>
        <section className={styles.stage}>
          <aside className={styles.story}>
            <span className={styles.kicker}>Заявка на пошив</span>
            <h1 className={styles.title}>{profile.publicIntakeTitle}</h1>

            <div className={styles.storyGrid}>
              <article className={styles.storyCard}>
                <div className={styles.storyHead}>Что важно указать</div>
                <div className={styles.storyList}>
                  <div>Номер для связи и доступные мессенджеры</div>
                  <div>Город, доставка и изделия</div>
                  <div>Желаемый срок и примечания</div>
                </div>
              </article>

              <article className={styles.storyCardAccent}>
                <div className={styles.storyHead}>Что будет дальше</div>
                <div className={styles.storyList}>
                  <div>Менеджер изучит заявку</div>
                  <div>Свяжется с вами удобным способом</div>
                  <div>После согласования оформит заказ</div>
                </div>
              </article>
            </div>
          </aside>

          <section className={styles.formShell}>
            <div className={styles.formHeader}>
              <div>
                <div className={styles.formTitle}>Заполните форму</div>
              </div>
              <div className={styles.formStamp}>01</div>
            </div>

            <section className={styles.panel}>
              <div className={styles.panelTitle}>Контакты</div>
              <div className={styles.grid}>
                <label className={styles.field}>
                  <span>Ваше имя</span>
                  <input
                    className={styles.input}
                    placeholder="Как к вам обращаться"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                  />
                </label>

                <label className={styles.field}>
                  <span>Телефон</span>
                  <input
                    className={styles.input}
                    inputMode="tel"
                    placeholder="+7(777)777-77-77"
                    value={phone}
                    onChange={(event) => setPhone(formatKazakhPhone(event.target.value))}
                  />
                </label>
              </div>

              <div className={styles.preferenceBlock}>
                <div className={styles.preferenceLabel}>На этом номере есть</div>
                <div className={styles.toggleRow}>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${hasWhatsApp ? styles.toggleBtnActive : ''}`}
                    onClick={() => setHasWhatsApp((value) => !value)}
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${hasTelegram ? styles.toggleBtnActive : ''}`}
                    onClick={() => setHasTelegram((value) => !value)}
                  >
                    Telegram
                  </button>
                </div>
              </div>

              <div className={styles.preferenceBlock}>
                <div className={styles.preferenceLabel}>Как вам удобнее ответить</div>
                <div className={styles.choiceRow}>
                  <button
                    type="button"
                    className={`${styles.choiceBtn} ${preferredContact === 'phone' ? styles.choiceBtnActive : ''}`}
                    onClick={() => setPreferredContact('phone')}
                  >
                    Звонок
                  </button>
                  <button
                    type="button"
                    disabled={!hasWhatsApp}
                    className={`${styles.choiceBtn} ${preferredContact === 'whatsapp' ? styles.choiceBtnActive : ''}`}
                    onClick={() => setPreferredContact('whatsapp')}
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    disabled={!hasTelegram}
                    className={`${styles.choiceBtn} ${preferredContact === 'telegram' ? styles.choiceBtnActive : ''}`}
                    onClick={() => setPreferredContact('telegram')}
                  >
                    Telegram
                  </button>
                </div>
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelTitle}>Город и доставка</div>
              <div className={styles.grid}>
                <label className={styles.field}>
                  <span>Город</span>
                  <div className={styles.inputWithIcon}>
                    <MapPin size={14} />
                    <input
                      className={styles.inputBare}
                      placeholder="Например, Алматы"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                    />
                  </div>
                </label>

                <label className={styles.field}>
                  <span>Способ доставки</span>
                  <select
                    className={styles.select}
                    value={deliveryMethod}
                    onChange={(event) => setDeliveryMethod(event.target.value)}
                  >
                    <option value="">Выберите вариант</option>
                    {DELIVERY_OPTIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Откуда вы о нас узнали</span>
                  <div className={styles.inputWithIcon}>
                    <RadioTower size={14} />
                    <input
                      className={styles.inputBare}
                      list="lead-source-options"
                      placeholder="Необязательно"
                      value={leadSource}
                      onChange={(event) => setLeadSource(event.target.value)}
                    />
                  </div>
                </label>
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <div className={styles.panelTitle}>Что нужно изготовить</div>
                <button
                  className={styles.ghostBtn}
                  onClick={() => setItems((state) => [...state, buildItem(productCatalog, fabricCatalog, sizeCatalog)])}
                >
                  <Plus size={14} />
                  Добавить позицию
                </button>
              </div>

              <div className={styles.itemStack}>
                {items.map((item, index) => (
                  <article key={item.key} className={styles.itemCard}>
                    <div className={styles.itemHead}>
                      <strong>Позиция {String(index + 1).padStart(2, '0')}</strong>
                      {items.length > 1 && (
                        <button
                          className={styles.removeBtn}
                          onClick={() => setItems((state) => state.filter((entry) => entry.key !== item.key))}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className={styles.grid}>
                      <label className={styles.field}>
                        <span>Изделие</span>
                        <input
                          className={styles.input}
                          list="client-products"
                          value={item.productName}
                          onChange={(event) => setItems((state) => state.map((entry) => (
                            entry.key === item.key ? { ...entry, productName: event.target.value } : entry
                          )))}
                        />
                      </label>

                      <label className={styles.field}>
                        <span>Материал или ткань</span>
                        <input
                          className={styles.input}
                          list="client-fabrics"
                          value={item.fabricPreference}
                          onChange={(event) => setItems((state) => state.map((entry) => (
                            entry.key === item.key ? { ...entry, fabricPreference: event.target.value } : entry
                          )))}
                        />
                      </label>

                      <label className={styles.field}>
                        <span>Размер или вариант</span>
                        <input
                          className={styles.input}
                          list="client-sizes"
                          value={item.size}
                          onChange={(event) => setItems((state) => state.map((entry) => (
                            entry.key === item.key ? { ...entry, size: event.target.value } : entry
                          )))}
                        />
                      </label>

                      <label className={styles.field}>
                        <span>Количество</span>
                        <input
                          className={styles.input}
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) => setItems((state) => state.map((entry) => (
                            entry.key === item.key
                              ? { ...entry, quantity: Math.max(1, Number(event.target.value || 1)) }
                              : entry
                          )))}
                        />
                      </label>

                      <label className={`${styles.field} ${styles.fieldWide}`}>
                        <span>Примечание по позиции</span>
                        <textarea
                          className={styles.textarea}
                          rows={3}
                          placeholder="Если у позиции есть особые пожелания, напишите их здесь"
                          value={item.notes}
                          onChange={(event) => setItems((state) => state.map((entry) => (
                            entry.key === item.key ? { ...entry, notes: event.target.value } : entry
                          )))}
                        />
                      </label>
                    </div>
                  </article>
                ))}
              </div>

              <datalist id="client-products">
                {productCatalog.map((item) => <option key={item} value={item} />)}
              </datalist>
              <datalist id="client-fabrics">
                {fabricCatalog.map((item) => <option key={item} value={item} />)}
              </datalist>
              <datalist id="client-sizes">
                {sizeCatalog.map((item) => <option key={item} value={item} />)}
              </datalist>
              <datalist id="lead-source-options">
                {LEAD_SOURCE_OPTIONS.map((item) => <option key={item} value={item} />)}
              </datalist>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelTitle}>Дополнительно</div>
              <div className={styles.grid}>
                <div className={`${styles.field} ${styles.calendarField}`} ref={calendarRef}>
                  <span>Желаемый срок</span>
                  <button
                    type="button"
                    className={styles.calendarTrigger}
                    onClick={() => setCalendarOpen((value) => !value)}
                  >
                    <CalendarDays size={14} />
                    <span>{selectedDate ? format(selectedDate, 'dd.MM.yyyy') : 'Выбрать дату'}</span>
                  </button>

                  {calendarOpen && (
                    <div className={styles.calendarPopover}>
                      <div className={styles.calendarHeader}>
                        <button
                          type="button"
                          className={styles.calendarNavBtn}
                          onClick={() => setCalendarMonth((value) => subMonths(value, 1))}
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <strong>{format(calendarMonth, 'LLLL yyyy', { locale: ru })}</strong>
                        <button
                          type="button"
                          className={styles.calendarNavBtn}
                          onClick={() => setCalendarMonth((value) => addMonths(value, 1))}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>

                      <div className={styles.calendarWeekdays}>
                        {CALENDAR_DAYS.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>

                      <div className={styles.calendarGrid}>
                        {calendarDays.map((day) => {
                          const active = selectedDate ? isSameDay(day, selectedDate) : false;
                          const muted = !isSameMonth(day, calendarMonth);
                          return (
                            <button
                              key={day.toISOString()}
                              type="button"
                              className={[
                                styles.calendarDay,
                                muted ? styles.calendarDayMuted : '',
                                active ? styles.calendarDayActive : '',
                                isToday(day) ? styles.calendarDayToday : '',
                              ].filter(Boolean).join(' ')}
                              onClick={() => {
                                setDesiredDate(format(day, 'yyyy-MM-dd'));
                                setCalendarOpen(false);
                              }}
                            >
                              {format(day, 'd')}
                            </button>
                          );
                        })}
                      </div>

                      <div className={styles.calendarActions}>
                        <button
                          type="button"
                          className={styles.calendarClearBtn}
                          onClick={() => {
                            setDesiredDate('');
                            setCalendarOpen(false);
                          }}
                        >
                          Без даты
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Общий комментарий</span>
                  <textarea
                    className={styles.textarea}
                    rows={4}
                    placeholder="Если есть пожелания по сроку, посадке или деталям заказа, напишите их здесь"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </label>
              </div>
            </section>

            <footer className={styles.footer}>
              <div className={styles.footerNote}>
                <Phone size={14} />
                <div>
                  <strong>Заявка отправляется менеджеру.</strong>
                  <span>В производство она попадёт только после согласования деталей.</span>
                </div>
              </div>

              <button className={styles.submitBtn} disabled={!canSubmit || saving} onClick={submit}>
                {saving ? 'Отправляю...' : 'Отправить заявку'}
                <ArrowRight size={16} />
              </button>
            </footer>
          </section>
        </section>
      </main>

      {submitted && (
        <div className={styles.successScene}>
          <video
            className={`${styles.successVideo} ${videoReady ? styles.successVideoReady : ''}`}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onLoadedData={handleSuccessVideoReady}
          >
            <source src={SUCCESS_VIDEO_SRC} type="video/mp4" />
          </video>
          <div className={`${styles.successFog} ${videoReady ? styles.successFogReady : ''}`} />
          <div className={`${styles.successGlow} ${videoReady ? styles.successGlowReady : ''}`} />

          <section className={`${styles.successPanel} ${videoReady ? styles.successPanelReady : ''}`}>
            <span className={styles.successKicker}><Wind size={12} /> Заявка отправлена</span>
            <h2 className={styles.successTitle}>Мы уже получили ваш запрос</h2>
            <p className={styles.successText}>
              Номер обращения <strong>{submitted.requestNumber}</strong>. Менеджер свяжется с вами и уточнит детали, стоимость и срок.
            </p>

            <div className={styles.successMeta}>
              <span><CheckCircle2 size={13} /> {submitted.city || 'Город уточним'}</span>
              <span><Truck size={13} /> {submitted.deliveryMethod || 'Доставка уточняется'}</span>
              <span><MessageCircle size={13} /> {messengerLabel(submitted.preferredContact)}</span>
            </div>

            <div className={styles.successActions}>
              <button className={styles.closeWindowBtn} onClick={closeWindow}>
                Закрыть окно
                <ArrowRight size={15} />
              </button>
              <button className={styles.secondarySceneBtn} onClick={() => setSubmitted(null)}>
                <ArrowLeft size={15} />
                Вернуться к форме
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
