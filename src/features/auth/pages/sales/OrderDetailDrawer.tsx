import { useEffect } from 'react';

interface OrderDetailDrawerProps {
  orderId: string;
  onClose: () => void;
  navigate: (path: string) => void;
}

export default function OrderDetailDrawer({ orderId, onClose, navigate }: OrderDetailDrawerProps) {
  useEffect(() => {
    navigate(`/sales/${orderId}`);
  }, [orderId, navigate]);

  return null;
}
