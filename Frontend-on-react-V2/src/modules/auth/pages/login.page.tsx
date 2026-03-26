import { motion } from 'framer-motion';
import { useLoginForm } from '@/modules/auth/hooks/use-login-form';
import styles from '@/modules/auth/pages/login.page.module.css';
import surface from '@/shared/ui/surface.module.css'

export default function LoginPage() {
  const { form, onSubmit, isSubmitting, lockRemainingMs } = useLoginForm();
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <motion.section
      className={`${surface.surface}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className={styles.header}>
        <p className={styles.kicker}>Granitka71</p>
        <h1>Вход в систему</h1>
      </div>

      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        className={styles.form}
        noValidate
      >
        <label className={styles.field}>
          <span>Логин</span>
          <input type="text" autoComplete="username" {...register('username')} />
          {errors.username && <small>{errors.username.message}</small>}
        </label>

        <label className={styles.field}>
          <span>Пароль</span>
          <input type="password" autoComplete="current-password" {...register('password')} />
          {errors.password && <small>{errors.password.message}</small>}
        </label>

        <button className={styles.submit} type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Выполняется вход...' : 'Войти'}
        </button>
        {lockRemainingMs > 0 && (() => {
          const totalSeconds = Math.ceil(lockRemainingMs / 1000);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;

          return (
            <p className={styles.formError}>
              Повторите попытку через {minutes} мин {seconds.toString().padStart(2, '0')} сек.
            </p>
          );
        })()}
      </form>
    </motion.section>
  );
}