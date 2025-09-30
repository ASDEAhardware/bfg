'use client';

import { useRequestPasswordReset } from '@/hooks/useAuth';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Mail } from 'lucide-react';

export default function ResetPasswordPage() {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const mutation = useRequestPasswordReset();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(email, {
            onSuccess: () => setSubmitted(true),
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-center text-xl">Reset Password</CardTitle>
                </CardHeader>
                <CardContent>
                    {submitted ? (
                        <Alert>
                            <Mail className="h-4 w-4" />
                            <AlertTitle>Controlla la tua email</AlertTitle>
                            <AlertDescription>
                                Ti abbiamo inviato un link per reimpostare la password.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="Inserisci la tua email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={mutation.isPending}>
                                {mutation.isPending ? 'Invio in corso...' : 'Invia link di reset'}
                            </Button>
                            {mutation.isError && (
                                <p className="text-sm text-red-500">
                                    Si è verificato un errore. Verifica l'indirizzo email.
                                </p>
                            )}
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

  