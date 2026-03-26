import styles from '@/shared/ui/placeholder-page.module.css';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className={`glass-card ${styles.page}`}>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}