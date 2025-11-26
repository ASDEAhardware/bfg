"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { User, Lock, Settings, Bell, Shield, Palette, Loader2, Sun, Moon, Monitor, CircleGauge, TriangleRight, GripVertical } from "lucide-react"
import { useChangePassword } from '@/hooks/useAuth';
import { Toaster, toast } from "sonner";
import { useUserInfo } from "@/hooks/useAuth"
import { Skeleton } from "@/components/ui/skeleton"
import { useQueryClient, useMutation } from "@tanstack/react-query"
import { api } from "@/lib/axios"
import axios from "axios"
import { useUserPreferences, usePatchResizeHandle, usePatchAccelerometerUnit, usePatchInclinometerUnit, usePatchLanguage } from "@/hooks/useUserPreferences";
import { useSettingsStore } from "@/store/settingsStore"
import { useTheme } from "next-themes";
import { useTranslations } from 'next-intl';
import { useSaveTheme } from "@/hooks/useSaveTheme"
import { AccelerometerUnit, InclinometerUnit, ShowResizeHandle, ThemeOption, LanguageOption } from "@/types/index"


import { useLocaleStore } from "@/store/localeStore";
import { useRouter } from "next/navigation";
import { Accordion } from "@/components/ui/accordion";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Lancelot } from "next/font/google"

export default function SettingsPage() {
    const [activeSection, setActiveSection] = useState("profile")
    const t = useTranslations('settings');

    const settingsNavigation = [
        {
            id: "profile",
            name: t('profile'),
            icon: User,
        },
        {
            id: "password",
            name: t('password'),
            icon: Lock,
        },
        {
            id: "preferences",
            name: t('preferences'),
            icon: Palette,
        },
        // {
        //     id: "notifications",
        //     name: t('notifications'),
        //     icon: Bell,
        // },
        // {
        //     id: "privacy",
        //     name: t('privacy'),
        //     icon: Shield,
        // },
    ]


    return (
        <div className="flex justify-center min-h-screen bg-background">
            <Toaster position="top-center" duration={3000} />
            <div className="flex max-w-7xl w-full">
                {/* Settings Sidebar - Hidden on mobile */}
                <div className="hidden md:block w-56 lg:w-64 fixed top-[calc(4rem+1px)] h-[calc(100vh-3rem-1px)]">
                    <div className="p-4 md:p-4">
                        <div className="flex items-center gap-2 mb-6">
                            <Settings className="h-5 w-5" />
                            <h2 className="text-lg font-semibold">{t('title')}</h2>
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
                <div className="flex-1 overflow-auto md:ml-56 lg:ml-64">
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
                        {activeSection === "preferences" && <PreferencesSection />}
                    </div>
                </div>
            </div>
        </div>
    )
}

function ProfileSection() {

    const t = useTranslations('settings');
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
                <h1 className="text-2xl font-bold">{t('profile')}</h1>
                <p className="text-muted-foreground">{t('profile_description')}</p>
            </div>

            <Accordion type="single" collapsible defaultValue="personal-info">
                <CollapsibleCard
                    value="personal-info"
                    title={t('personal_information')}
                    description={t('personal_information_description')}
                >
                    <div className="space-y-6">
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
                                {/*Button per permettere all'utente di cambiare la sua immagine profilo*/}
                                {/* <Button
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
                                </Button> */}
                                {/* !!!! SBLOCCA QUESTO INPUT PER FARLO FUNZIONARE !!!! */}
                                {/* <input
                                    type="file"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleFileChange} // 6.
                                    accept="image/jpeg,image/png,image/gif"
                                /> */}
                                {/* <p className="text-xs text-muted-foreground">JPG, GIF o PNG. Max 2MB.</p> */}
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
                            <Button className="cursor-pointer">{t('save_changes_button')}</Button>
                        </div>
                    </div>
                </CollapsibleCard>
            </Accordion>
        </div>
    )
}

function PasswordSection() {

    const t = useTranslations('settings');

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
                <h1 className="text-2xl font-bold">{t('password')}</h1>
                <p className="text-muted-foreground">{t('password_description')}</p>
            </div>

            <Accordion type="single" collapsible defaultValue="change-password">
                <CollapsibleCard
                    value="change-password"
                    title={t('change_password')}
                    description={t('change_password_description')}
                >
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="old-password">{t('current_password')}</Label>
                            <Input
                                id="old-password"
                                type="password"
                                required
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                placeholder={t('current_password_placeholder')} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password1">{t('new_password')}</Label>
                            <Input
                                id="new-password1"
                                type="password"
                                required
                                value={newPassword1}
                                onChange={(e) => setNewPassword1(e.target.value)}
                                placeholder={t('new_password_placeholder')} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password2">{t('confirm_new_password')}</Label>
                            <Input
                                id="new-password2"
                                type="password"
                                required
                                value={newPassword2}
                                onChange={(e) => setNewPassword2(e.target.value)}
                                placeholder={t('confirm_new_password_placeholder')} />
                        </div>

                        <Separator />

                        <div className="bg-muted/50 p-4 rounded-lg">
                            <h4 className="text-sm font-medium mb-2">{t('password_requirements')}:</h4>
                            <ul className="text-xs text-muted-foreground space-y-1">
                                <li>• {t('password_number_characters')}</li>
                                <li>• {t('password_capital_letter')}</li>
                                <li>• {t('password_lowercase_letter')}</li>
                                <li>• {t('password_number')}</li>
                                <li>• {t('password_special_character')}</li>
                            </ul>
                        </div>

                        <div className="flex justify-end">
                            <Button className="cursor-pointer" type="submit" disabled={mutation.isPending}>
                                {mutation.isPending ? t('update_password_button_status') : t('update_password_button')}
                            </Button>
                        </div>
                    </form>
                </CollapsibleCard>
            </Accordion>
        </div>
    )
}

function NotificationsSection() {

    const t = useTranslations('settings');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">{t('notifications')}</h1>
                <p className="text-muted-foreground">{t('notifications_description')}</p>
            </div>

            <Accordion type="single" collapsible>
                <CollapsibleCard
                    value="notifications"
                    title={t('notifications_preferences')}
                    description={t('notifications_preferences_description')}
                >
                    <p className="text-muted-foreground">Section under development...</p>
                </CollapsibleCard>
            </Accordion>
        </div>
    )
}

function PrivacySection() {

    const t = useTranslations('settings');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">{t('privacy')}</h1>
                <p className="text-muted-foreground">{t('privacy_description')}</p>
            </div>

            <Accordion type="single" collapsible>
                <CollapsibleCard
                    value="privacy"
                    title={t('privacy_settings')}
                    description={t('privacy_settings_description')}
                >
                    <p className="text-muted-foreground">Section under development...</p>
                </CollapsibleCard>
            </Accordion>
        </div>
    )
}



function PreferencesSection() {
    const queryClient = useQueryClient();
    const {setTheme} = useTheme();
    const { data: preferences, isLoading: isLoadingPreferences, isError } = useUserPreferences();
    const themeMutation = useSaveTheme();
    const resizeHandleMutation = usePatchResizeHandle();
    const accelerometerUnitMutation = usePatchAccelerometerUnit();
    const inclinometerUnitMutation = usePatchInclinometerUnit();
    const languageMutation = usePatchLanguage();
    const t = useTranslations('settings');
    const router = useRouter();

    // Initialize local states for the form
    const [localTheme, setLocalTheme] = useState<ThemeOption>(preferences?.theme || 'system');
    const [accelerometerUnit, setAccelerometerUnit] = useState(preferences?.accelerometer_unit || 'ms2');
    const [inclinometerUnit, setInclinometerUnit] = useState(preferences?.inclinometer_unit || 'deg');
    const [localShowResizeHandle, setLocalShowResizeHandle] = useState(preferences?.show_resize_handle || 'show');
    const [language, setLanguage] = useState(preferences?.language || 'en');

    const { locale, setLocale } = useLocaleStore();

    // recupera i dati da useUserPreferences() che è l'hook contenente la chiamata API in GET per mantenere la stato locale aggiornato con il DB
    useEffect(() => {
        if (preferences) {
            setLocalTheme(preferences.theme);
            setAccelerometerUnit(preferences.accelerometer_unit);
            setInclinometerUnit(preferences.inclinometer_unit);
            setLocalShowResizeHandle(preferences.show_resize_handle);
            setLanguage(preferences.language);
        }
    }, [preferences]);
    

    /**
     * useRef permette di creare un oggetto la cui proprietà .current sopravvive ai diversi re-render senza innescarne di nuovi
     * 
     * Utilizzato per memorizzare l'ID del timer (ritornato da window.setTimeout)
     * 
     * È quindi un riferimento persistente al timer, in modo che possa essere cancellato
     * 
     * Il tipo number | null è perché setTimeout in un ambiente browser restituisce un ID numerico.
     */
    const themeSaveTimer = useRef<number | null>(null); 
    const resizeHandleSaveTimer = useRef<number | null>(null);
    const accelerometerUnitSaveTimer = useRef<number | null>(null);
    const inclinometerUnitSaveTimer = useRef<number | null>(null);
    const languageSaveTimer = useRef<number | null>(null);


    /**
     * @param value: 'light' | 'dark' | 'system'
     * Funzione che viene invocata ogni volta che l'utente seleziona un nuovo tema tramite radio btn
     */
    const handleThemeChange = (value: ThemeOption) => {
        setLocalTheme(value);
        setTheme(value);

        if (themeSaveTimer.current) {
            window.clearTimeout(themeSaveTimer.current);
        }

        themeSaveTimer.current = window.setTimeout(() => {
            themeMutation.mutate(value);
            themeSaveTimer.current = null;
        }, 3000);
    };

    /**
     * @param value: 'show' | 'hide'
     * Funzione che viene invocata ogni volta che l'utente seleziona una preferenza per la maniglia di ridimensionamento
     */
    const handleResizeHandleChange = (value: ShowResizeHandle) => {
        setLocalShowResizeHandle(value);
        if (resizeHandleSaveTimer.current) {
            window.clearTimeout(resizeHandleSaveTimer.current);
        }
        resizeHandleSaveTimer.current = window.setTimeout(() => {
            resizeHandleMutation.mutate(value);
            resizeHandleSaveTimer.current = null;
        }, 3000);
    };

    /**
     * @param value: 'ms2' | 'g'
     * Funzione che viene invocata ogni volta che l'utente seleziona un'unità di misura per l'accelerometro
     */
    const handleAccelerometerUnitChange = (value: AccelerometerUnit) => {
        setAccelerometerUnit(value);
        if (accelerometerUnitSaveTimer.current) {
            window.clearTimeout(accelerometerUnitSaveTimer.current);
        }
        accelerometerUnitSaveTimer.current = window.setTimeout(() => {
            accelerometerUnitMutation.mutate(value);
            accelerometerUnitSaveTimer.current = null;
        }, 3000);
    };
    
    /**
     * @param value: 'deg' | 'rad'
     * Funzione che viene invocata ogni volta che l'utente seleziona un'unità di misura per l'inclinometro
     */
    const handleInclinometerUnitChange = (value: InclinometerUnit) => {
        setInclinometerUnit(value);
        if (inclinometerUnitSaveTimer.current) {
            window.clearTimeout(inclinometerUnitSaveTimer.current);
        }
        inclinometerUnitSaveTimer.current = window.setTimeout(() => {
            inclinometerUnitMutation.mutate(value);
            inclinometerUnitSaveTimer.current = null;
        }, 3000);
    };

    const handleLanguageChange = (value: LanguageOption) => {
        setLanguage(value);
        if (locale === value) return;
        setLocale(value);

        if (languageSaveTimer.current) {
            window.clearTimeout(languageSaveTimer.current);
        }
        languageSaveTimer.current = window.setTimeout(() => {
            languageMutation.mutate(value);
            languageSaveTimer.current = null;
        }, 3000);
    };

    // Pulisce il timer al unmount
    useEffect(() => {
        return () => {
            if (themeSaveTimer.current) {
                window.clearTimeout(themeSaveTimer.current);
            }
            if (resizeHandleSaveTimer.current) {
                window.clearTimeout(resizeHandleSaveTimer.current);
            }
            if (accelerometerUnitSaveTimer.current) {
                window.clearTimeout(accelerometerUnitSaveTimer.current);
            }
            if (inclinometerUnitSaveTimer.current) {
                window.clearTimeout(inclinometerUnitSaveTimer.current);
            }
            if (languageSaveTimer.current) {
                window.clearTimeout(languageSaveTimer.current);
            }
        };
    }, []);

    // const handleLanguageChange = (newLanguage: string) => {
    //   if (locale === newLanguage) return;

    //   setLocale(newLanguage as any);
    //   router.refresh();
    // }

    if (isLoadingPreferences) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">{t('preferences')}</h1>
                    <p className="text-muted-foreground">{t('preferences_description')}</p>
                </div>
                <div className="space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-1/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </div>
            </div>
        )
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center h-40 justify-center">
                <span className="text-red-500 mb-2">
                    Error loading preferences settings.
                </span>
                <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['userPreferences'] })}>Try Again</Button>
            </div>
        );
    }

    return (
        <div>
            <div>
                <h1 className="text-2xl font-bold">{t('preferences')}</h1>
                <p className="text-muted-foreground">{t('preferences_description')}</p>
            </div>

            <Accordion type="multiple" className="space-y-6">
                <CollapsibleCard
                    value="theme"
                    title={t('theme')}
                    description={t('theme_description')}
                >
                    <RadioGroup value={localTheme || 'system'} onValueChange={handleThemeChange} className="space-y-3">
                        <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value="light" id="light" />
                            <Label htmlFor="light" className="flex items-center gap-3 cursor-pointer flex-1">
                                <Sun className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <div className="font-medium">{t('light')}</div>
                                    <div className="text-sm text-muted-foreground">{t('light_description')}</div>
                                </div>
                            </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value="dark" id="dark" />
                            <Label htmlFor="dark" className="flex items-center gap-3 cursor-pointer flex-1">
                                <Moon className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <div className="font-medium">{t('dark')}</div>
                                    <div className="text-sm text-muted-foreground">{t('dark_description')}</div>
                                </div>
                            </Label>
                        </div>

                        <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value="system" id="system" />
                            <Label htmlFor="system" className="flex items-center gap-3 cursor-pointer flex-1">
                                <Monitor className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <div className="font-medium">{t('system')}</div>
                                    <div className="text-sm text-muted-foreground">{t('system_description')}</div>
                                </div>
                            </Label>
                        </div>
                    </RadioGroup>
                </CollapsibleCard>

                <CollapsibleCard
                    value="language"
                    title={t('language')}
                    description={t('language_description')}
                >
                    <RadioGroup value={locale} onValueChange={handleLanguageChange} className="space-y-3">
                        <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value="en" id="english" />
                            <Label htmlFor="english" className="cursor-pointer flex-1">
                                <div>
                                    <div className="font-medium">{t('english')}</div>
                                    <div className="text-sm text-muted-foreground">{t('english_description')}</div>
                                </div>
                            </Label>
                        </div>

                        <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value="it" id="italian" />
                            <Label htmlFor="italian" className="cursor-pointer flex-1">
                                <div>
                                    <div className="font-medium">{t('italian')}</div>
                                    <div className="text-sm text-muted-foreground">{t('italian_description')}</div>
                                </div>
                            </Label>
                        </div>
                    </RadioGroup>
                </CollapsibleCard>

                <CollapsibleCard
                    value="grid"
                    title={t('grid_layout')}
                    description={t('grid_description')}
                >
                    <RadioGroup
                        value={localShowResizeHandle}
                        onValueChange={handleResizeHandleChange}
                        className="space-y-3"
                    >
                        <Label className="text-base font-medium"> <GripVertical />{t('resize_handle')}</Label>
                        <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value="show" id="show-handle" />
                            <Label htmlFor="show-handle" className="cursor-pointer flex-1">
                                <div>
                                    <div className="font-medium">{t('resize_handle_show')}</div>
                                    <div className="text-sm text-muted-foreground">{t('resize_handle_show_description')}</div>
                                </div>
                            </Label>
                        </div>

                        <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value="hide" id="hide-handle" />
                            <Label htmlFor="hide-handle" className="cursor-pointer flex-1">
                                <div>
                                    <div className="font-medium">{t('resize_handle_hide')}</div>
                                    <div className="text-sm text-muted-foreground">{t('resize_handle_hide_description')}</div>
                                </div>
                            </Label>
                        </div>
                    </RadioGroup>
                </CollapsibleCard>

                <CollapsibleCard
                    value="units"
                    title={t('measurement_units')}
                    description={t('measurement_units_description')}
                >
                    <div className="space-y-6">
                        {/* Accelerometer unit selection */}
                        <div className="space-y-3">
                            <Label className="text-base font-medium"> <CircleGauge /> {t('accelerometers')}</Label>
                            <RadioGroup value={accelerometerUnit} onValueChange={handleAccelerometerUnitChange} className="space-y-3">
                                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                                    <RadioGroupItem value="ms2" id="ms2" />
                                    <Label htmlFor="ms2" className="cursor-pointer flex-1">
                                        <div>
                                            <div className="font-medium">{t('ms2')}</div>
                                            <div className="text-sm text-muted-foreground">{t('ms2_description')}</div>
                                        </div>
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                                    <RadioGroupItem value="g" id="g" />
                                    <Label htmlFor="g" className="cursor-pointer flex-1">
                                        <div>
                                            <div className="font-medium">{t('g')}</div>
                                            <div className="text-sm text-muted-foreground">{t('g_description')}</div>
                                        </div>
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>

                        <Separator />

                        {/* Inclinometer unit selection */}
                        <div className="space-y-3">
                            <Label className="text-base font-medium"> <TriangleRight /> {t('inclinometers')}</Label>
                            <RadioGroup value={inclinometerUnit} onValueChange={handleInclinometerUnitChange} className="space-y-3">
                                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                                    <RadioGroupItem value="deg" id="deg" />
                                    <Label htmlFor="deg" className="cursor-pointer flex-1">
                                        <div>
                                            <div className="font-medium">{t('deg')}</div>
                                            <div className="text-sm text-muted-foreground">{t('deg_description')}</div>
                                        </div>
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                                    <RadioGroupItem value="rad" id="rad" />
                                    <Label htmlFor="rad" className="cursor-pointer flex-1">
                                        <div>
                                            <div className="font-medium">{t('rad')}</div>
                                            <div className="text-sm text-muted-foreground">{t('rad_description')}</div>
                                        </div>
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>
                </CollapsibleCard>
            </Accordion>
        </div>
    )
}
