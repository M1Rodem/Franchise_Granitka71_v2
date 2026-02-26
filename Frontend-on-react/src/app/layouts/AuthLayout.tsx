import styles from '@/app/layouts/auth-layout.module.css';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.backdrop} />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
