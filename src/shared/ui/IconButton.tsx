import type { ReactNode, ComponentProps } from 'react';
import { Button } from './Button';

type ButtonProps = ComponentProps<typeof Button>;

interface Props extends Omit<ButtonProps, 'children' | 'icon' | 'iconRight'> {
  icon: ReactNode;
  label: string;
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  className,
  ...props
}: Props) {
  return (
    <Button
      {...props}
      variant={variant}
      size="sm"
      icon={icon}
      className={className}
      aria-label={label}
      title={label}
    />
  );
}
