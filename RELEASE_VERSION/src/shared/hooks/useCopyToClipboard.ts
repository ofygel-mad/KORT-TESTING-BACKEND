import { toast } from 'sonner';

export function useCopyToClipboard() {
  return (text: string, label = 'Скопировано') => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(label);
    });
  };
}
