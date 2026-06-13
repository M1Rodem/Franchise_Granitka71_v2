import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { isAxiosError } from 'axios';
import { authApi } from '@/modules/auth/api/auth.api';
import { useAuthStore } from '@/shared/store/auth.store';
import { showTempMessage } from '@/shared/ui/temp-message.service';
import { useEffect, useState } from 'react';
import { offlineEmployeesService } from '@/modules/offline/services/offline-employees.service';
import { useOfflineSessionStore } from '@/modules/offline/store/offline-session.store';
import { offlinePlotsService } from '@/modules/offline/services/offline-plots.service'

const loginSchema = z.object({
  username: z.string().min(1, 'Введите логин'),
  password: z.string().min(1, 'Введите пароль'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function useLoginForm() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [lockRemainingMs, setLockRemainingMs] = useState<number>(0);

  useEffect(() => {
    if (lockRemainingMs <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setLockRemainingMs((prev) => {
        if (prev <= 1000) {
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockRemainingMs]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
    mode: 'onTouched',
  });

  const loginMutation = useMutation({
    mutationFn: (payload: LoginFormValues) => authApi.login(payload),

    onSuccess: async ({ token, refreshToken: _refreshToken, ...user }) => {
      setSession({ user, token })
      setLockRemainingMs(0);
      
      showTempMessage('info', 'Загрузка данных для оффлайн режима...');

      // Синхронизация сотрудников (ждем)
      try {
        const employeesResult = await offlineEmployeesService.syncEmployees();
        console.log('[Sync] Employees:', employeesResult);
      } catch (error) {
        console.error('Failed to sync employees:', error);
        showTempMessage('warning', 'Не удалось загрузить список сотрудников');
      }

      // Синхронизация участков (ждем)
      try {
        const plotsResult = await offlinePlotsService.syncPlots();
        console.log('[Sync] Plots:', plotsResult);
      } catch (error) {
        console.error('Failed to sync plots:', error);
        showTempMessage('warning', 'Не удалось загрузить список участков');
      }

      // Сохраняем текущего пользователя как выбранного сотрудника для оффлайн режима
      const setOfflineEmployee = useOfflineSessionStore.getState().setCurrentEmployee;
      setOfflineEmployee({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        lastSyncedAt: new Date().toISOString(),
      });

      showTempMessage('success', 'Вход выполнен успешно');
      navigate('/orders', { replace: true });
    },

    onError: (error) => {
      if (isAxiosError(error)) {
        if (error.response?.status === 429) {
          const retryAfter =
            (error.response.data as any)?.retryAfterSeconds ?? 0;

          if (retryAfter > 0) {
            setLockRemainingMs(retryAfter * 1000);
          }

          showTempMessage(
            'error',
            'Слишком много попыток входа. Попробуйте позже.',
          );

          return;
        }

        const data = error.response?.data as any;

        if (typeof data?.remainingAttempts === 'number') {
          showTempMessage(
            'error',
            `${data.message}. Осталось попыток: ${data.remainingAttempts}`,
          );
        } else {
          showTempMessage(
            'error',
            data?.message ?? 'Не удалось выполнить вход',
          );
        }
        return;
      }

      showTempMessage('error', 'Не удалось выполнить вход');
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (lockRemainingMs > 0) {
      return;
    }

    loginMutation.mutate(values);
  });

  return {
    form,
    isSubmitting: loginMutation.isPending || lockRemainingMs > 0,
    onSubmit,
    lockRemainingMs,
  };
}