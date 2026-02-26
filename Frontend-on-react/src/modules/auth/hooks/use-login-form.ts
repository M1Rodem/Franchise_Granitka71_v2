import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { isAxiosError } from 'axios';
import { authApi } from '@/modules/auth/api/auth.api';
import { useAuthStore } from '@/shared/store/auth.store';
import type { ApiErrorResponse } from '@/shared/types/api';

const loginSchema = z.object({
  username: z.string().min(1, 'Введите логин'),
  password: z.string().min(1, 'Введите пароль'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function useLoginForm() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

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
    onSuccess: ({ token, ...user }) => {
      setSession({ user, token });
      navigate('/orders', { replace: true });
    },
    onError: (error) => {
      const errorMessage =
        isAxiosError<ApiErrorResponse>(error) && error.response?.data?.message
          ? error.response.data.message
          : 'Не удалось выполнить вход';

      form.setError('root', { message: errorMessage });
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    loginMutation.mutate(values);
  });

  return {
    form,
    isSubmitting: loginMutation.isPending,
    onSubmit,
  };
}