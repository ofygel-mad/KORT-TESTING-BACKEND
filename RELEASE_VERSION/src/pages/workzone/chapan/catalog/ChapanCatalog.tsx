import { WarehouseCatalog } from '../../../warehouse/WarehouseCatalog';
import styles from './ChapanCatalog.module.css';

export default function ChapanCatalogPage() {
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Каталог товаров</h1>
        <p className={styles.subtitle}>
          Здесь загружаются товары, их цвета, размеры и другие параметры для складского каталога
        </p>
      </div>
      <div className={styles.content}>
        <WarehouseCatalog />
      </div>
    </div>
  );
}
