export interface Customer {
  id:           string;
  full_name:    string;
  company_name: string;
  phone:        string;
  email:        string;
  source:       string;
  status:       'new' | 'active' | 'inactive' | 'archived';
  owner:        { id:string; full_name:string; avatar_url?:string } | null;
  tags:         string[];
  created_at:   string;
  updated_at:   string;
  health?: { score: number; band: 'green' | 'yellow' | 'red'; factors?: Record<string, unknown> };
}

export const STATUS_LABELS: Record<Customer['status'], string> = {
  new:'Новый', active:'Активный', inactive:'Неактивный', archived:'Архив',
};

export const STATUS_COLORS: Record<Customer['status'], { bg:string; color:string }> = {
  new:      { bg:'#DBEAFE', color:'#1D4ED8' },
  active:   { bg:'#D1FAE5', color:'#065F46' },
  inactive: { bg:'#F3F4F6', color:'#6B7280' },
  archived: { bg:'#F3F4F6', color:'#9CA3AF' },
};
