import { useEffect } from 'react';

interface OrderDetailDrawerProps {
  orderId: string;
  onClose: () => void;
  navigate: (path: string) => void;
}

export default function OrderDetailDrawer({ orderId, onClose, navigate }: OrderDetailDrawerProps) {
  useEffect(() => {
    navigate(`/workzone/chapan/orders/${orderId}`);
  }, [orderId, navigate]);

  return null;
}
