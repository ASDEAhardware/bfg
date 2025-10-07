import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as authService from "@/services/auth.service"; // <-- Importa il service layer
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { User } from "@/types/user";

export const useUserInfo = () => {
  const setUser = useAuthStore((state) => state.setUser);

  const query = useQuery({
    queryKey: ["userInfo"],
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
    queryFn: authService.getMe, // <-- Usa la funzione del service
  });

  useEffect(() => {
    if (query.data) {
      setUser(query.data);
    }
  }, [query.data, setUser]);

  return query;
};

export const useLogin = () => {
  const setUser = useAuthStore((state) => state.setUser);
  const { setTheme } = useTheme();
  const router = useRouter();

  return useMutation({
    mutationFn: authService.login, // <-- Usa la funzione del service
    onSuccess: (user_data: User) => {
      // La funzione di servizio ora restituisce direttamente user_data
      if (user_data && user_data.theme) {
        setTheme(user_data.theme);
      }
      setUser(user_data);
      router.push("/dashboard"); // router.push() causa un client-side navgation (soft navgation)
    },
  });
};

export const useLogout = () => {
  const clearUser = useAuthStore((state) => state.clearUser);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.logout, // <-- Usa la funzione del service
    onSuccess: () => {
      clearUser();
      queryClient.removeQueries({ queryKey: ['userInfo'] });
      window.location.href = "/login?logoutSuccess=true"; // a differenza di router.push() causa un full page reload (hard navigation) della pagina
    },
  });
};

export const useRequestPasswordReset = () => {
  return useMutation({
    mutationFn: authService.requestPasswordReset, // <-- Usa la funzione del service
  });
};

export const useConfirmPasswordReset = () => {
  return useMutation({
    mutationFn: authService.confirmPasswordReset, // <-- Usa la funzione del service
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: authService.changePassword, // <-- Usa la funzione del service
  });
};

