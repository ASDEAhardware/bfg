"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { User, Lock, Settings, Bell, Shield, Palette, Loader2 } from "lucide-react"
import { useChangePassword } from '@/hooks/useAuth';
import { Toaster, toast } from "sonner";
import { useUserInfo } from "@/hooks/useAuth"
import { Skeleton } from "@/components/ui/skeleton"
import { useQueryClient, useMutation } from "@tanstack/react-query"
import { api } from "@/lib/axios"
import axios from "axios"

const settingsNavigation = [
    {
        id: "profile",
        name: "Profile",
        icon: User,
    },
    {
        id: "password",
        name: "Password",
        icon: Lock,
    },
    //{
    //     id: "notifications",
    //     name: "Notifiche",
    //     icon: Bell,
    // },
    // {
    //     id: "privacy",
    //     name: "Privacy",
    //     icon: Shield,
    // },
    // {
    //     id: "appearance",
    //     name: "Aspetto",
    //     icon: Palette,
    // },
]

export default function SettingsPage() {
    const [activeSection, setActiveSection] = useState("profile")

    return (
        <div className="flex justify-center min-h-screen bg-background">
            <Toaster position="top-center" duration={3000} />
            <div className="flex max-w-7xl w-full">
                {/* Settings Sidebar - Hidden on mobile */}
                <div className="hidden md:block w-56 lg:w-64">
                    <div className="p-4 md:p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Settings className="h-5 w-5" />
                            <h2 className="text-lg font-semibold">Settings</h2>
                        </div>
                        <nav className="space-y-2">
                            {settingsNavigation.map((item) => {
                                const Icon = item.icon
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveSection(item.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors cursor-pointer ${activeSection === item.id
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                            }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span>{item.name}</span>
                                    </button>
                                )
                            })}
                        </nav>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-auto">
                    <div className="md:hidden border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                        <div className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Settings className="h-5 w-5" />
                                <h2 className="text-lg font-semibold">Settings</h2>
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {settingsNavigation.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveSection(item.id)}
                                        className={`flex-shrink-0 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap ${activeSection === item.id
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                            }`}
                                    >
                                        {item.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 md:p-6 lg:p-8 max-w-4xl">
                        {activeSection === "profile" && <ProfileSection />}
                        {activeSection === "password" && <PasswordSection />}
                        {activeSection === "notifications" && <NotificationsSection />}
                        {activeSection === "privacy" && <PrivacySection />}
                        {activeSection === "appearance" && <AppearanceSection />}
                    </div>
                </div>
            </div>
        </div>
    )
}

function ProfileSection() {

    const { data, isLoading, isError } = useUserInfo();

    // Istanziamo il queryClient
    const queryClient = useQueryClient();
    // Accediamo all'elemento dell'input nel DOM senza effettuare un re-render del componente
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 1. STATO PER L'ANTEPRIMA DELL'IMMAGINE
    const [previewImage, setPreviewImage] = useState<string | undefined>(undefined);
    // `previeImage` terrà traccia dell'URL dell'immagine da mostrare all'utente, questo stato è fondamentale per mostrare un'anteprima dell'immagine e recuperare il suo url in Base64 dalla memoria client side, prima di uploadarla sul server

    // CHIAMATA API PER CARICARE LA FOTO SUL SERVER
    const mutation = useMutation({
        mutationFn: async (file: File) => {
            // 3. PREPARAZIONE DEI DATI E CHIAMATA AXIOS
            const formData = new FormData(); //FormData è un oggetto nativo di JavaScript che ti permette di costruire una serie di coppie chiave/valore, come farebbe un form HTML.
            formData.append("image", file); // `"image"` è la chiave, il file è il valore di quella chiave

            const response = await api.post("change-profile-image/", formData);

            return response.data;
        },
        onSuccess: (data) => {
            // 4. GESTIONE DEL SUCCESS
            toast.success("Profile picture updated successfully.");
            queryClient.invalidateQueries({ queryKey: ["userInfo"] });
        },
        onError: (error) => {
            // 5. GESTIONE DEGLI ERROR
            // Questa parte gestisce principalmente `error 400 Bad Request` (formato troppo grande o errato) in quanto l'error `401` è già gestito dall'istanza Axios (api).
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.error || "Something went wrong.");
            } else {
                // Gestisce errori di rete o altri errori non-Axios
                toast.error("Something went wrong. Try again later.");
            }
            // Ripristina l'anteprima dell'immagine solo in caso di errore
            setPreviewImage(data?.profile_image);
        },
    });

    // `previeImage` terrà traccia dell'URL dell'immagine da mostrare all'utente, questo stato è fondamentale per mostrare un'anteprima dell'immagine e recuperare il suo url in Base64 dalla memoria client side, prima di uploadarla sul server

    // 2. SINCRONIZZAZIONE DELLO STATO CON I DATI DELLA QUERY
    // `useEffect` si assicura che lo stato `previewImage` sia sempre sincronizzato con i dati data forniti dalla query 
    useEffect(() => {
        if (data?.profile_image) {
            setPreviewImage(data.profile_image);
        }
    }, [data]);

    if (isError) {
        return (
            <div className="flex flex-col items-center h-40 justify-center">
                <span className="text-red-500 mb-2">
                    Error loading user data.
                </span>
                <Button onClick={() => window.location.reload()}>Try Again</Button>
            </div>
        );
    }


    // Funzione ceh prende il file che l'utente ha selezionato, verifica che non sia più grande di 2MB, se lo è mostra un toast di errore
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]; // `event.target` = Elemento HTML che ha generato l'evento (l'input tag) | .files? = È una FileList, ovvero un array-like di tutti i file selezionati dall'utente. | .[0] = Questo è optional chaining: significa "se files esiste, prendi il primo elemento".

        if (file) {

            if (file.size > 2 * 1024 * 1024) { // Limite di 2MB, in quanto file.size è in Bytes
                toast.error("The image is too large. The maximum size is 2MB.");
                return;
            }

            const reader = new FileReader();

            reader.onloadend = () => {
                // 6. CREAZIONE E AGGIORNAMENTO DELL'ANTEPRIMA
                setPreviewImage(reader.result as string);
            };

            reader.readAsDataURL(file);

            // 7. ESECUZIONE DELLA MUTAZIONE
            mutation.mutate(file);
        }
    }

    const handleButtonClick = () => {
        // 8. ATTIVAZIONE DELL'INPUT FILE
        fileInputRef.current?.click();
    }


    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Profile</h1>
                <p className="text-muted-foreground">Manage your profile information and account preferences.</p>
            </div>

            <Card className="border border-border">
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>Update your profile picture and personal details here.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center gap-6">
                        {isLoading ? (
                            <Skeleton className="h-20 w-20 rounded-full" />
                        ) : (
                            <Avatar className="h-20 w-20">
                                <AvatarImage
                                    // 9. UTILIZZO DELLO STATO DELL'ANTEPRIMA
                                    src={previewImage || "/user-profile-illustration.png"}
                                    alt="Foto profilo"
                                />
                                <AvatarFallback className="text-lg">{data?.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                        )}

                        <div className="space-y-2">
                            <Button
                                className="cursor-pointer"
                                variant="outline"
                                size="sm"
                                onClick={handleButtonClick} // 8.
                                disabled={mutation.isPending}
                            >
                                {mutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : null}
                                Change Picture
                            </Button>
                            {/* !!!! SBLOCCA QUESTO INPUT PER FARLO FUNZIONARE !!!! */}
                            {/* <input
                                type="file"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileChange} // 6.
                                accept="image/jpeg,image/png,image/gif"
                            /> */}
                            <p className="text-xs text-muted-foreground">JPG, GIF o PNG. Max 2MB.</p>
                        </div>
                    </div>

                    {/* <Separator /> */}

                    {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nome utente</Label>
              <Input id="username" placeholder="mario.rossi" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="mario.rossi@example.com"
              />
            </div> */}
                    {/* <div className="space-y-2">
              <Label htmlFor="firstName">Nome</Label>
              <Input id="firstName" placeholder="Mario" defaultValue="Mario" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Cognome</Label>
              <Input id="lastName" placeholder="Rossi" defaultValue="Rossi" />
            </div> */}
                    {/* </div> */}

                    <div className="flex justify-end">
                        <Button className="cursor-pointer">Save Changes</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function PasswordSection() {

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword1, setNewPassword1] = useState('');
    const [newPassword2, setNewPassword2] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const mutation = useChangePassword();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(
            { new_password1: newPassword1, new_password2: newPassword2, old_password: oldPassword },
            {
                onSuccess: () => {
                    setSubmitted(true);
                    // Pulisci il form 
                    toast.success("Password updated successfully!");
                    setOldPassword("");
                    setNewPassword1("");
                    setNewPassword2("");
                },
                onError: () => {
                    toast.error("An error occurred, please check that your information is correct.");
                },
            }
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Password</h1>
                <p className="text-muted-foreground">Update your password to keep your account secure.</p>
            </div>

            <Card className="border border-border">
                <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>Make sure your new password is strong and secure.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form onSubmit={handleSubmit} className="space-y-2">
                        <div className="space-y-2">
                            <Label htmlFor="old-password">Current Password</Label>
                            <Input
                                id="old-password"
                                type="password"
                                required
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                placeholder="Inserisci la password attuale" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password1">New password</Label>
                            <Input
                                id="new-password1"
                                type="password"
                                required
                                value={newPassword1}
                                onChange={(e) => setNewPassword1(e.target.value)}
                                placeholder="Inserisci la nuova password" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password2">Confirm new password</Label>
                            <Input
                                id="new-password2"
                                type="password"
                                required
                                value={newPassword2}
                                onChange={(e) => setNewPassword2(e.target.value)}
                                placeholder="Conferma la nuova password" />
                        </div>

                        <Separator />

                        <div className="bg-muted/50 p-4 rounded-lg">
                            <h4 className="text-sm font-medium mb-2">Password Requirements:</h4>
                            <ul className="text-xs text-muted-foreground space-y-1">
                                <li>• At least 8 characters</li>
                                <li>• At least one capital letter</li>
                                <li>• At least one lowercase letter</li>
                                <li>• At least one number</li>
                                <li>• At least one special character</li>
                            </ul>
                        </div>

                        <div className="flex justify-end">
                            <Button className="cursor-pointer" type="submit" disabled={mutation.isPending}>
                                {mutation.isPending ? 'Updating...' : 'Update Password'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

function NotificationsSection() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Notifications</h1>
                <p className="text-muted-foreground">Configure how and when to receive notifications.</p>
            </div>

            <Card className="border border-border">
                <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>Choose which notifications you want to receive.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Section under development...</p>
                </CardContent>
            </Card>
        </div>
    )
}

function PrivacySection() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Privacy</h1>
                <p className="text-muted-foreground">Manage your privacy and security settings.</p>
            </div>

            <Card className="border border-border">
                <CardHeader>
                    <CardTitle>Privacy settings</CardTitle>
                    <CardDescription>Control who can see your information.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Section under development...</p>
                </CardContent>
            </Card>
        </div>
    )
}

function AppearanceSection() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Aspect</h1>
                <p className="text-muted-foreground">Customize the aspect of the interface.</p>
            </div>

            <Card className="border border-border">
                <CardHeader>
                    <CardTitle>Theme</CardTitle>
                    <CardDescription>Choose how you want the interface to appear.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Section under development...</p>
                </CardContent>
            </Card>
        </div>
    )
}
