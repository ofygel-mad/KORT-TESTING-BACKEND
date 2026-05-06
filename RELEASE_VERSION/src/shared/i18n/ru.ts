export const ru = {
  nav: {
    dashboard: 'Главная',
    customers: 'Клиенты',
    deals: 'Сделки',
    tasks: 'Задачи',
    reports: 'Отчёты',
    settings: 'Настройки',
    automations: 'Автоматизации',
    imports: 'Импорт',
    audit: 'Аудит',
  },
  common: {
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    edit: 'Редактировать',
    create: 'Создать',
    loading: 'Загрузка...',
    error: 'Произошла ошибка',
    empty: 'Нет данных',
    search: 'Поиск...',
  },
  customer: {
    title: 'Клиенты',
    new: 'Новый клиент',
    full_name: 'Имя',
    company: 'Компания',
    phone: 'Телефон',
    email: 'Email',
    status: 'Статус',
    source: 'Источник',
    bin_iin: 'БИН/ИИН',
  },
  deal: {
    title: 'Сделки',
    new: 'Новая сделка',
    amount: 'Сумма',
    stage: 'Этап',
    won: 'Выиграна',
    lost: 'Проиграна',
    open: 'В работе',
  },
} as const;

type ValuesToString<T> = { [K in keyof T]: T[K] extends Record<string, unknown> ? ValuesToString<T[K]> : string };

export type TKeys = ValuesToString<typeof ru>;
