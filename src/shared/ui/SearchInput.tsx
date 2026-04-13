import { Search } from 'lucide-react';
import s from './SearchInput.module.css';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder='Поиск...' }: Props) {
  return (
    <div className={s.root}>
      <Search size={14} className={s.icon} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={s.input}
      />
    </div>
  );
}
