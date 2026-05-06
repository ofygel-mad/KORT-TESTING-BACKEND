import s from './PageLoader.module.css';

export function PageLoader() {
  return (
    <div className={s.root}>
      <div className={s.spinner} />
    </div>
  );
}
