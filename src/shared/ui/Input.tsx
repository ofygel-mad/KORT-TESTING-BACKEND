import {
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  forwardRef,
} from 'react';
import styles from './Input.module.css';

type InputSize = 'sm' | 'md' | 'lg';

// ─── Base shared props ─────────────────────────────────────────────────────
interface FieldBaseProps {
  label?:    string;
  hint?:     string;
  error?:    string;
  required?: boolean;
  prefix?:   ReactNode;  // icon or element before the input
  suffix?:   ReactNode;  // icon or element after the input
  size?:     InputSize;
}

// ─── Input ─────────────────────────────────────────────────────────────────
interface InputProps extends FieldBaseProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {}

/**
 * Input — полноценное поле с label, hint, error и иконками.
 *
 * @example
 * <Input
 *   label="Email"
 *   type="email"
 *   placeholder="ivanov@company.kz"
 *   prefix={<Mail size={15} />}
 *   error={errors.email?.message}
 *   required
 * />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      label,
      hint,
      error,
      required,
      prefix,
      suffix,
      size = 'md',
      className,
      id,
      ...props
    },
    ref,
  ) {
    const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    const inputCls = [
      styles.input,
      error      ? styles.hasError  : '',
      prefix     ? styles.withPrefix : '',
      suffix     ? styles.withSuffix : '',
      size === 'sm' ? styles.inputSm : '',
      size === 'lg' ? styles.inputLg : '',
      className ?? '',
    ].join(' ').trim();

    return (
      <div className={styles.field}>
        {label && (
          <label className={styles.label} htmlFor={inputId}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}

        <div className={styles.inputWrap}>
          {prefix && <span className={styles.prefix}>{prefix}</span>}

          <input
            ref={ref}
            id={inputId}
            className={inputCls}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` :
              hint  ? `${inputId}-hint`  : undefined
            }
            {...props}
          />

          {suffix && <span className={styles.suffix}>{suffix}</span>}
        </div>

        {error && !hint && (
          <span id={`${inputId}-error`} className={styles.errorMsg} role="alert">
            {error}
          </span>
        )}
        {hint && !error && (
          <span id={`${inputId}-hint`} className={styles.hint}>
            {hint}
          </span>
        )}
      </div>
    );
  }
);

// ─── Textarea ──────────────────────────────────────────────────────────────
interface TextareaProps extends FieldBaseProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size' | 'prefix'> {
  rows?: number;
}

/**
 * Textarea — многострочное поле с той же архитектурой что и Input.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { label, hint, error, required, prefix: _prefix, suffix: _suffix, size = 'md', className, id, rows = 3, ...props },
    ref,
  ) {
    const inputId = id ?? (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    const cls = [
      'kort-textarea',
      error ? styles.hasError : '',
      className ?? '',
    ].join(' ').trim();

    return (
      <div className={styles.field}>
        {label && (
          <label className={styles.label} htmlFor={inputId}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={inputId}
          className={cls}
          rows={rows}
          aria-invalid={!!error}
          {...props}
        />

        {error && <span className={styles.errorMsg} role="alert">{error}</span>}
        {hint && !error && <span className={styles.hint}>{hint}</span>}
      </div>
    );
  }
);
