 'use client';

import { useConfirmPasswordReset } from '@/hooks/useAuth';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CheckCircle } from 'lucide-react';

export default function ResetPasswordConfirmPageWrapper() {
    return (
        <Suspense fallback={<div>Loading...</div>}> 
            <ResetPasswordConfirmPage />
        </Suspense> // Suspense é un fall back mentre i dati di useSearchParamas arrivano (in quanto async), puoi sostituire con uno spinner
    );
}

function ResetPasswordConfirmPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const uid = searchParams.get('uid') || '';
    const token = searchParams.get('token') || '';

    const [newPassword1, setNewPassword1] = useState('');
    const [newPassword2, setNewPassword2] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const mutation = useConfirmPasswordReset();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(
            { uid, token, new_password1: newPassword1, new_password2: newPassword2 },
            {
                onSuccess: () => {
                    setSubmitted(true);
                    setTimeout(() => {
                        router.push('/');
                    }, 3000);
                },
            }
        );
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-center text-xl">Imposta nuova password</CardTitle>
                </CardHeader>
                <CardContent>
                    {submitted ? (
                        <Alert>
                            <CheckCircle className="h-4 w-4" />
                            <AlertTitle>Password aggiornata</AlertTitle>
                            <AlertDescription>
                                Verrai reindirizzato al login tra qualche secondo...
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-password1">Nuova Password</Label>
                                <Input
                                    id="new-password1"
                                    type="password"
                                    required
                                    value={newPassword1}
                                    onChange={(e) => setNewPassword1(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-password2">Conferma Password</Label>
                                <Input
                                    id="new-password2"
                                    type="password"
                                    required
                                    value={newPassword2}
                                    onChange={(e) => setNewPassword2(e.target.value)}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={mutation.isPending}>
                                {mutation.isPending ? 'Salvataggio...' : 'Imposta Password'}
                            </Button>
                            {mutation.isError && (
                                <p className="text-sm text-red-500">
                                    Si è verificato un errore. Verifica che i dati siano corretti.
                                </p>
                            )}
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

  