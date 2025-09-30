import { LoginClient } from '@/components/LoginClient';
import { LogoutToastHandler } from '@/components/LogoutToastHandler';
import { Toaster } from 'sonner';

export default async function LoginPage() {

  return (
    <>
      <Toaster position="top-center" duration={3000} />
      <LogoutToastHandler />
      <LoginClient />
    </>
  );
}
    
    