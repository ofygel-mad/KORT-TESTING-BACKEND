import {
  forwardRef,
  useRef,
  type ChangeEvent,
  type InputHTMLAttributes,
} from 'react';
import { formatKazakhPhoneInput } from '../utils/kz';

export type PhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode'>;

/**
 * Masked phone input for Kazakhstan: +7 (XXX) XXX-XX-XX
 *
 * - Formats display as user types; hard-limits to 10 local digits
 * - Works with react-hook-form register() AND controlled state
 * - onChange always emits the formatted string (e.g. "+7 (700) 123-45-67")
 * - To get raw API format use normalizeKazakhPhone() from shared/utils/kz
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, ...rest }, outerRef) => {
    const innerRef = useRef<HTMLInputElement>(null);
    const isControlled = value !== undefined;

    function mergeRef(el: HTMLInputElement | null) {
      (innerRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      if (typeof outerRef === 'function') outerRef(el);
      else if (outerRef) (outerRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    }

    function handleChange(e: ChangeEvent<HTMLInputElement>) {
      const formatted = formatKazakhPhoneInput(e.target.value);
      // Mutate target so react-hook-form and direct consumers receive the formatted value
      e.target.value = formatted;
      onChange?.(e);

      // For uncontrolled inputs (react-hook-form register without value prop):
      // React won't update the DOM, so do it manually
      if (!isControlled) {
        requestAnimationFrame(() => {
          const el = innerRef.current;
          if (!el) return;
          el.value = formatted;
          el.setSelectionRange(formatted.length, formatted.length);
        });
      }
    }

    // For controlled: always show formatted version of the value prop
    const displayValue = isControlled
      ? formatKazakhPhoneInput(String(value ?? ''))
      : undefined;

    return (
      <input
        {...rest}
        ref={mergeRef}
        type="tel"
        inputMode="numeric"
        placeholder={rest.placeholder ?? '+7 (___) ___-__-__'}
        {...(isControlled ? { value: displayValue } : {})}
        onChange={handleChange}
      />
    );
  },
);

PhoneInput.displayName = 'PhoneInput';
