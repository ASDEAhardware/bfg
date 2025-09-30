const fs = require('fs');
const path = require('path');
const readline = require("readline"); // Utile per interagire con il terminale
const { execSync } = require("child_process"); // Per eseguire comandi shell
const { mkdir } = require('fs').promises;

const frontendDir = __dirname; // Percorso della cartella frontend

//--DEFINIZIONE delle funzioni /utilities.py
function printColoredJs(message, color = "green"){
    const colors = {
        green: "\x1b[92m",
        red: "\x1b[91m",
        yellow: "\x1b[93m",
        blue: "\x1b[94m",
        reset: "\x1b[0m"
    };
    console.log(`${colors[color] }${message}${colors.reset}`);
}


async function getValidInputJs(prompt, validChoices, defaultChoice = null, errorMsg = "❌ Scelta non valida. Riprova."){
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    const ask = () => {
        return new Promise(resolve => {
            rl.question(prompt, (answer) => {
                resolve(answer.trim().toLowerCase());
            });
        });
    }
    while (true) {
        const userInput = await ask();

        // Se l'input è vuoto e c'è una scelta di default, restituiscila
        if (userInput === '' && defaultChoice !== null) {
          rl.close();
          return defaultChoice;
        }

        // Altrimenti, controlla se l'input è tra le scelte valide
        if (validChoices.includes(userInput)) {
            rl.close();
            return userInput;
        }
        printColoredJs(errorMsg, "red");
    }
}

function runCommandJs(command, cwd = null) {
  try {
    execSync(command, {
      cwd: cwd || process.cwd(),
      stdio: "pipe", // Cambiato da 'inherit' a 'pipe' per catturare output
      shell: true,
      encoding: "utf-8"
    });
  } catch (error) {
    printColoredJs(`❌ Errore durante il comando: ${command}`, "red");
    
    console.error("Codice errore:", error.status);
    console.error("Messaggio:", error.message);
    console.error("stdout:", error.stdout);
    console.error("stderr:", error.stderr);

    process.exit(1);
  }
}



//DEFINIZIONE delle funzioni /misc_generator.py
//-------------------------- Funzione per creare il file e il codice di un'istanza Axios -------------------------- 
function createAxiosInstanceFile() {
    const dirPath = path.join(__dirname, 'src', 'lib'); // '__dirname' è il percorso della cartella corrente
    const filePath = path.join(dirPath, 'axios.ts');
    const axiosContent = `import axios from "axios";

// Il client Axios viene configurato per inviare i cookie con le richieste.
// Non è più necessario leggere i token da Zustand.
const api = axios.create({
    baseURL: '/api/',
    withCredentials: true,
});

// L'interceptor di richiesta non deve più aggiungere l'header di autorizzazione,
// perché i cookie vengono inviati automaticamente dal browser.
// Questo intercettore ora può essere rimosso o utilizzato per altre logiche.
api.interceptors.request.use(
    (config) => {
        // Esempio di utilizzo: aggiungere un header diverso
        // config.headers["X-Custom-Header"] = "value";
        return config;
    },
    (error) => Promise.reject(error)
);

// L'interceptor di risposta gestisce solo i casi in cui l'autenticazione è fallita.
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Se la risposta è 401 e la richiesta non è per il login,
        // significa che il middleware di Next.js non è riuscito a rinfrescare il token.
        // L'utente deve essere reindirizzato al login.
        if (error.response?.status === 401 && !originalRequest.url.includes('/user/login/')) {
            // Reindirizza l'utente alla pagina di login.
            // Dato che l'access e refresh token sono cookie, verranno puliti dal middleware
            // al reindirizzamento.
            window.location.href = "/";
            return Promise.reject(error);
        }

        return Promise.reject(error);
    }
);

export { api };

`;
    // Crea la cartella se non esiste
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true }); //recursive: true permette di creare cartelle genitore se non esistono
        console.log(`[Axios Instance] Cartella creata: ${dirPath}`);
    }

    // Scrive il file axios.ts
    fs.writeFileSync(filePath, axiosContent);
    console.log(`[Axios Instance] File creato: ${filePath}`);
}

function generateAxiosServerInstanceCode(){
    const dirPath = path.join(__dirname, 'src', 'lib');
    const filePath = path.join(dirPath, 'axios-server.ts');
    const content = `import axios from "axios";

// Nome del servizio Django definito in docker-compose.yml
const DJANGO_SERVICE_NAME = "backend"; 
const DJANGO_PORT = "8000";

// Questa istanza è comoda in quanto oltre ad una gestione centralizzata dell'URL
// utile anche perchè imposta automaticamente l'header content-type
const apiServer = axios.create({
    // Utilizziamo il nome del servizio Docker come hostname
    baseURL: \`http://\${DJANGO_SERVICE_NAME}:\${DJANGO_PORT}/\`,
    // withCredentials: true, È un'impostazione per i soli browser, nelle chiamate server to server, i token vanno estratti e inoltrati manualmente a meno che non crei un wrapper
});


export { apiServer };
    
    `;
    fs.writeFileSync(filePath, content);
    console.log(`[Axios server instance] File creato: ${filePath}`);
}


function createQueryClientFile() {
    const dirPath = path.join(__dirname, 'src', 'lib'); // '__dirname' è il percorso della cartella corrente
    const filePath = path.join(dirPath, 'queryClient.ts');
    const queryClientContent = `// Qui puoi specificare le opzioni che si applicano a tutte le query e mutazioni
// a meno che non vengano sovrascritte a livello di query/mutazione specifica.

import { QueryClient } from '@tanstack/react-query';
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1, // Numero di tentativi di retry per le query
            refetchOnWindowFocus: false, // Non rifare il fetch quando la finestra è a fuoco
            staleTime: 1000 * 60 * 5, // Tempo di stale per le query (5 minuti)
        },
        mutations: {
            retry: 1, // Numero di tentativi di retry per le mutazioni
        },
    },
});
`;

    // Crea la cartella se non esiste
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true }); //recursive: true permette di creare cartelle genitore se non esistono
        console.log(`[Query Client] Cartella creata: ${dirPath}`);
    }
    // Scrive il file queryClient.ts
    fs.writeFileSync(filePath, queryClientContent);
    console.log(`[Query Client] File creato: ${filePath}`);
}

function createProvidersFile() {
    const dirPath = path.join(__dirname, 'src', 'app'); // '__dirname' è il percorso della cartella corrente
    const filePath = path.join(dirPath, 'providers.tsx');
    const providersContent = `'use client';
//Qui puoi raggruppare tutti i provider client-side di alto livello mantenendo il file layout.tsx pulito e semplice.

import { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query'; // Importa il provider di React Query
import { queryClient } from '@/lib/queryClient'; // istanza di QueryClient
import { ThemeProvider } from "@/components/theme-provider"
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

interface ProvidersProps {
    children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
                storageKey="theme"
            >
                {children}
            </ThemeProvider>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
`;
    // Crea la cartella se non esiste
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true }); 
    }
    // Scrive il file providers.tsx
    fs.writeFileSync(filePath, providersContent);
    console.log(`[Providers] File creato: ${filePath}`);}

function createHooksDirectory() {
    const hooksDirPath = path.join(__dirname, 'src', 'hooks');
    // Crea la cartella se non esiste
    if (!fs.existsSync(hooksDirPath)) {
        fs.mkdirSync(hooksDirPath, { recursive: true }); //recursive: true permette di creare cartelle genitore se non esistono
        console.log(`[Hooks Directory] Cartella creata: ${hooksDirPath}`);
    }
}


function createLayoutFile() {
    const layoutPath = path.join(__dirname, 'src', 'app', 'layout.tsx');
    const layoutContent = `\
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={\`\${geistSans.variable} \${geistMono.variable} antialiased\`}
      >
        <Providers>
            {children}
        </Providers>
      </body>
    </html>
  );
}
`;
    // Scrive il file layout.tsx
    fs.writeFileSync(layoutPath, layoutContent);
    console.log(`[Layout] File modificato: ${layoutPath}`);
}

function createTypesDirectory() {
    const typesDirPath = path.join(__dirname, 'src', 'types');
    const indexPath = path.join(typesDirPath, 'index.ts');

    typeIndexContent = `// File index.ts per esportare centralmente i tipi
export type LoginCredentials = {
    username: string,
    password: string
}

export type ConfirmResetPayload = {
    uid: string;
    token: string;
    new_password1: string;
    new_password2: string;
}

export type ChangePasswordPayload = {
    old_password: string;
    new_password1: string;
    new_password2: string;
}

`;

    // Crea la cartella se non esiste
    if (!fs.existsSync(typesDirPath)) { 
        fs.mkdirSync(typesDirPath, { recursive: true }); //recursive: true permette di creare cartelle genitore se non esistono
        console.log(`[Types Directory] Cartella creata: ${typesDirPath}`);
    } else {
      console.log(`La directory esiste già: ${typesDirPath}`);
    }

    // Scrive il file index.ts
    fs.writeFileSync(indexPath, typeIndexContent);
    console.log(`[Types Directory] File index.ts creato: ${indexPath}`);
}

function createPrivateDir() {
    const privateDirPath = path.join(__dirname, 'src', 'app', '(private)');
    
    // Crea la cartella se non esiste
    if (!fs.existsSync(privateDirPath)) {
        fs.mkdirSync(privateDirPath, { recursive: true }); //recursive: true permette di creare cartelle genitore se non esistono
        console.log(`[Private Directory] Cartella creata: ${privateDirPath}`);
    } else {
        console.log(`Directory già creata: ${privateDirPath}`);
    }
}

function createGuestDir(){
    const dirPath = path.join(__dirname, 'src', 'app', '(private)', '(guest)');

    // Crea la directory se non esiste
    if(!fs.existsSync(dirPath)){
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`[Default Directory] creata con successo.`);
    } else {
        console.log(`Directory già creata: ${dirPath}`);
    }
}

function createEnvLocalFile() {
    const envLocalPath = path.join(__dirname, '.env.local');
    const envContent = `# Variabili d'ambiente per Next.js
NEXT_PUBLIC_API_URL=http://localhost:8000
# Questa variabile sarà letta dal tuo codice Next.js.
# Il Middleware e i Server Components la useranno per chiamare il backend.
DJANGO_API_URL=http://backend:8000 #variabile d'ambiente da utilizzare per comunicare con il container del backend per chiamate api
NEXT_PUBLIC_BACKEND_CONTAINER_URL=http://backend:8000 #variabile d'ambiente per evitare di dover hardcodare l'url del container del backend ad esempio
#per effettuare sostituzioni di url per recuperare correttamente le immagini

#Usa sempre variabili che iniziano con NEXT_PUBLIC_ per accedere agli URL lato client.
`;
    // Scrive il file .env.local
    fs.writeFileSync(envLocalPath, envContent);
    console.log(`[.env.local] File creato: ${envLocalPath}`);
}

function fixHMR() {
    // === 1. Update package.json ===
    const packageJsonPath = 'package.json';

    try {
      const rawData = fs.readFileSync(packageJsonPath, 'utf-8');
      const data = JSON.parse(rawData);

      if (data.scripts && data.scripts.dev) {
        const oldValue = data.scripts.dev;
        data.scripts.dev = 'next dev -H 0.0.0.0 -p 3000';
        console.log(`[package.json] Campo 'scripts.dev' aggiornato da '${oldValue}' a '${data.scripts.dev}'`);
      } else {
        console.log(`[package.json] Errore: campo 'scripts.dev' non trovato.`, "red");
      }

      fs.writeFileSync(packageJsonPath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(`[package.json] Errore durante la modifica: ${e.message}`);
    }

    // === 2. Update next.config.ts ===
    const nextConfigPath = 'next.config.ts';

    const newConfig = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configurazione sperimentale
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Forza polling in ambienti con problemi di HMR
  webpackDevMiddleware: (config: any) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
};

export default nextConfig;
    `;

    try {
      fs.writeFileSync(nextConfigPath, newConfig);
      console.log(`[next.config.ts] File creato con successo: ${nextConfigPath}`);
    } catch (e) {
      console.error(`[next.config.ts] Errore durante la scrittura: ${e.message}`);
    }
}

function createImageDir(){
    const imgDirPath = path.join(__dirname, 'public', 'images');

    //crea la cartella se non esiste
    if (!fs.existsSync(imgDirPath)) {
        fs.mkdirSync(imgDirPath, { recursive: true });
        console.log(`[Images Directory] Cartella creata: ${imgDirPath}`);
    } else {
        console.log(`Directory già creata: ${imgDirPath}`);
    }
}


function overwriteGlobalPage(){
    const pageGlobalPath = path.join(__dirname, 'src', 'app', 'page.tsx')
    const pageContent = `\

`;
    //Scrive il file page.tsx globale
    fs.writeFileSync(pageGlobalPath, pageContent);
    console.log(`[global page.tsx] File modificato: ${pageGlobalPath}`);
}



function createPrivateLayout() {
    const layoutPath = path.join(__dirname, 'src', 'app', '(private)', 'layout.tsx');

    //Crea il file layout.tsx per la dir (private)
    fs.writeFileSync(layoutPath, '', 'utf8');   
} 

function createLoginClientComponent() {
    const loginClientPath = path.join(__dirname, 'src', 'components', 'LoginClient.tsx');
    const loginClientContent = ` 'use client';

import { GalleryVerticalEnd } from "lucide-react"
import { LoginForm } from "@/components/login-form"
import Image from "next/image"
import { useLogin } from "@/hooks/useAuth";
import { LoginCredentials } from "@/types";


export function LoginClient() {
    const login = useLogin();

    const handleLogin = (form: LoginCredentials) => {
        login.mutate(form);
    };

    return (
        <div className="grid min-h-svh lg:grid-cols-2">
            <div className="flex flex-col gap-4 p-6 md:p-10">
                <div className="flex justify-center gap-2 md:justify-start">
                    <a href="#" className="flex items-center gap-2 font-medium">
                        <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
                            <GalleryVerticalEnd className="size-4" />
                        </div>
                        Generated By Zion.
                    </a>
                </div>
                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-xs">
                        <LoginForm
                            onLoginSubmit={handleLogin}
                            isLoading={login.isPending}
                            error={login.isError ? 'Credenziali non valide' : undefined}
                        />
                    </div>
                </div>
            </div>
            <div className="bg-muted relative hidden lg:block">
                <Image
                    src="/placeholder.svg"
                    alt="Logo della mia azienda"
                    fill
                />
            </div>
        </div>
    );
}
    
    `;
    //Scrive il file LoginClient.tsx
    fs.writeFileSync(loginClientPath,loginClientContent);
    console.log(`[Login Client Component] file creato: ${loginClientPath}`);
}


function createUtilsGlobal(){
    const dirPath = path.join(__dirname, 'src', 'utils');

    if(!fs.existsSync(dirPath)){
        fs.mkdirSync(dirPath, { recursive: true });
        console.log("Directory utils creata!");
    } else {
        console.log("Directory [utils/] già esistente!");
    }

    const dateFormatterPath = path.join(dirPath, 'dateFormatters.ts');

    const content = `
/**
 * Formatta una data nel formato italiano (gg/mm/aaaa).
 * @param date - La data da formattare. Può essere una stringa ISO, un timestamp, o un oggetto Date.
 * @returns La data formattata come stringa in formato italiano.
 */
export const formatDateToItalian = (date: Date | string | number): string => {
    // Crea un oggetto Date. Se è già un oggetto Date, lo usa; altrimenti, ne crea uno.
    const dateObj = date instanceof Date ? date : new Date(date);

    // Controlla se la data è valida (es. evita "Invalid Date")
    if (isNaN(dateObj.getTime())) {
        return 'Data non valida';
    }

    // Opzioni per la formattazione locale italiana (giorno numerico, mese numerico, anno numerico)
    const options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    };

    // Utilizza Intl.DateTimeFormat per la formattazione con la locale 'it-IT'
    return new Intl.DateTimeFormat('it-IT', options).format(dateObj);
};

/**
 * Formatta una data nel formato americano (mm/gg/aaaa).
 * @param date - La data da formattare. Può essere una stringa ISO, un timestamp, o un oggetto Date.
 * @returns La data formattata come stringa in formato americano.
 */
export const formatDateToAmerican = (date: Date | string | number): string => {
    // Crea un oggetto Date. Se è già un oggetto Date, lo usa; altrimenti, ne crea uno.
    const dateObj = date instanceof Date ? date : new Date(date);

    // Controlla se la data è valida (es. evita "Invalid Date")
    if (isNaN(dateObj.getTime())) {
        return 'Invalid Date'; // o il messaggio che preferisci in inglese
    }

    // Opzioni per la formattazione locale americana (mese numerico, giorno numerico, anno numerico)
    const options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    };

    // Utilizza Intl.DateTimeFormat per la formattazione con la locale 'en-US'
    // Nota: 'en-US' produce mm/dd/yyyy
    return new Intl.DateTimeFormat('en-US', options).format(dateObj);
};
    `;
    if(!fs.existsSync(dateFormatterPath)){
        fs.writeFileSync(dateFormatterPath, content);
        console.log("File [dateFormatters.ts] creato correttamente, ${dateFormatterPath}");
    } else {
        console.log("File [dateFormatters.ts] esiste già!");
    }
}   


function generateEnvLocalExample(){
    const filePath = path.join(__dirname, "example.env.local");

    const content =`
# Variabili d'ambiente per Next.js
NEXT_PUBLIC_API_URL=
# Questa variabile sarà letta dal tuo codice Next.js.
# Il Middleware e i Server Components la useranno per chiamare il backend.
DJANGO_API_URL=      #variabile d'ambiente da utilizzare per comunicare con il container del backend per chiamate api
NEXT_PUBLIC_BACKEND_CONTAINER_URL=           #variabile d'ambiente per evitare di dover hardcodare l'url del container del backend ad esempio
#per effettuare sostituzioni di url per recuperare correttamente le immagini

#Usa sempre variabili che iniziano con NEXT_PUBLIC_ per accedere agli URL lato client.
    `;
    if(!fs.existsSync(filePath)){
        fs.writeFileSync(filePath, content);
        console.log("File [example.env.local] Creato correttamente!");
    } else {
        console.log("File [example.env.local] esistente!");
    }
}



//DEFINIZIONE delle funzioni /auth_files.py

function overwriteLoginForm(){
    const loginFormPath = path.join(__dirname, 'src', 'components', 'login-form.tsx')
    const loginFormContent = `\
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"


type LoginFormProps = React.ComponentProps<"form"> & {
  onLoginSubmit: (form: {username: string; password: string}) => void;
  isLoading?: boolean;
  error?: string;
};


export function LoginForm({
  className,
  onLoginSubmit,
  isLoading,
  error,
  ...formProps
}: LoginFormProps) {
  const [form, setForm] = useState({username:'', password: ''});
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({...form, [e.target.name]: e.target.value});
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-6", className)} {...formProps}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Login to your account</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Enter your username below to login to your account
        </p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="username">Username</Label>
          <Input id="username" type="text" placeholder="username" name="username" value={form.username} onChange={handleChange} required />
        </div>
        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            <a
              href="/reset-password"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </a>
          </div>
          <Input id="password" type="password" placeholder="password" name="password" value={form.password} onChange={handleChange} required />
        </div>
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Logging in...' : 'Login'}
        </Button>
        {error && <p className="text-md text-red-600">{error}</p>}
      </div>
    </form>
  )
}  
 
`;    
    //Scrive il file login-form.tsx
    fs.writeFileSync(loginFormPath, loginFormContent);
    console.log(`[login-form.tsx] File modificato: ${loginFormPath}`);
}

function createAuthts(){
  const authtsFilePath = path.join(__dirname, 'src', 'hooks', 'useAuth.ts');
  const authtsContent = `import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as authService from "@/services/auth.service"; // <-- Importa il service layer
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useTheme } from "next-themes";
import { useEffect } from "react";

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
    onSuccess: (user_data) => {
      // La funzione di servizio ora restituisce direttamente user_data
      if (user_data && (user_data as any).theme) {
        setTheme((user_data as any).theme);
      }
      setUser(user_data);
      router.push("/dashboard"); // router.push() causa un client-side navgation (soft navgation)
    },
  });
};

export const useLogout = () => {
  const clearUser = useAuthStore((state) => state.clearUser);
  const router = useRouter();
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

`;
  //Scrive il file /src/lib/auth.ts
  fs.writeFileSync(authtsFilePath, authtsContent);
  console.log(`File auth.ts creato e scritto correttamente: ${authtsFilePath}`);
}

function generateLayoutResetPswConfirm(){
  const resetDirPath = path.join(__dirname, 'src', 'app', 'reset-password', 'confirm', 'layout.tsx');
  const content = `
export default function ResetPasswordConfirmLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
  `;
  try{
    fs.writeFileSync(resetDirPath, content);
    console.log(`File creato e scritto correttamente: ${resetDirPath}`);
  } catch (e){
    console.error(`[/confirm/layout.tsx] Errore durante la scrittura: ${e.messsage}`);
  }
}

function generateResetDirsFiles(){
  const resetDir = path.join(__dirname, 'src', 'app', '(auth)', 'reset-password');
  const resetPage = path.join(resetDir, 'page.tsx');
  const confirmDir = path.join(resetDir, 'confirm');
  const confirmPage = path.join(confirmDir, 'page.tsx');

  const resetContent = `'use client';

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

  `;

  const confirmContent = ` 'use client';

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

  `;

  //Crea le directories
  if(!fs.existsSync(resetDir)){
    fs.mkdirSync(resetDir, { recursive: true });
    console.log(`Directory creata: ${resetDir}`);
  } else {
    console.log(`Directory già esistente: ${resetDir}`);
  }

  if(!fs.existsSync(confirmDir)){
    fs.mkdirSync(confirmDir, { recursive: true });
    console.log(`Directory creata: ${confirmDir}`);
  } else {
    console.log(`Directory già esistente: ${confirmDir}`);
  }

  //Scrittura dei file
  try{
    fs.writeFileSync(resetPage, resetContent);
    console.log(`File creato e scritto correttamente: ${resetPage}`);
  } catch (e){
    console.error(`[/reset-password/page.tsx] Errore durante la scrittura: ${e.message}`);
  }

  try{
    fs.writeFileSync(confirmPage, confirmContent);
    console.log(`File creato e scritto correttamente: ${confirmPage}`);
  } catch (e){
    console.error(`[/confirm/page.tsx] Errore durante la scrittura: ${e.messsage}`);
  }

}

function generateStoreDirAndFile(){
  const storeDir = path.join(__dirname, 'src', 'store');
  const storeFile = path.join(storeDir, 'authStore.ts');
  storeFileContent = `import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    pk: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    // Aggiungi altri campi utente se presenti
}

interface AuthState {
    isAuthenticated: boolean;
    user: User | null;
    clearUser: () => void;
    // setUser ora accetta solo i dati dell'utente, non più l'access token
    setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            // Stato iniziale
            isAuthenticated: false,
            user: null,

            // Azioni dello store
            clearUser: () => set({ isAuthenticated: false, user: null }),
            setUser: (user) => set({ isAuthenticated: true, user }),
        }),
        {
            name: 'auth-storage', // Nome per la chiave nel Local Storage

            // persistiamo solo isAuthenticated e user
            partialize: (state) => ({
                isAuthenticated: state.isAuthenticated,
                user: state.user,
            }),
        }
    )
);

  `;
  //Crea le directories
  if(!fs.existsSync(storeDir)){
    fs.mkdirSync(storeDir, { recursive: true });
    console.log(`Directory creata: ${storeDir}`);
  } else {
    console.log(`Directory già esistente: ${storeDir}`);
  }

  //Scrive il file
  fs.writeFileSync(storeFile, storeFileContent);
  console.log(`File 'authStore.ts' creato correttamente`);

}


//DEFINIZIONE delle funzioni /app_generator.py
function createAuthDirectory(){
    const dirPath = path.join(__dirname, "src", "app", "(auth)", "login");
    
    //Crea le directories se non esistono
    if (!fs.existsSync(dirPath)){
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Directory creata: ${dirPath}`);
    }

    const filePath = path.join(dirPath, "page.tsx");

    content = `import { LoginClient } from '@/components/LoginClient';
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
    
    `;
    fs.writeFileSync(filePath, content);
    console.log("File creato: ${filePath}");
}


function createDashboardApp(){
    const DashboardDirPath = path.join(__dirname, 'src', 'app', '(private)', '(guest)', 'dashboard');
    const DashboardPageFilePath = path.join(DashboardDirPath, 'page.tsx');
    const DashboardPageContent = `"use client";
import React, { useEffect } from "react";
import { useUserInfo } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

import { Playfair_Display } from 'next/font/google';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const playfairDisplay = Playfair_Display({ subsets: ['latin'] });

export default function DashboardPage() {
    const { data, isLoading, error } = useUserInfo();

    if (isLoading) {
        return (
            <div className="flex justify-center">
                <Skeleton className="h-10 w-48 mt-3" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center">
                <span className="text-red-500 mt-3">
                    Errore nel caricamento dei dati utente.
                </span>
            </div>
        );
    }

    return (
        <>
            <div className="flex justify-center">
                <h2 className={\`\${playfairDisplay.className} text-4xl m-5\`}>
                    Benvenuto <i>{data?.username ?? ""}</i>
                </h2>
            </div>
            <div className="flex justify-center mx-10">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>
                            Titolo della card
                        </CardTitle>
                    </ CardHeader>
                    <CardContent>
                        <CardDescription>
                            Descrizione della card. Dove verrà mostrato il contenuto. <br />
                            Altro contenuto a capo.
                        </CardDescription>
                    </CardContent>
                </Card>
            </div>

        </>
    );
}
    
`; 

    //Crea la cartella se non esiste
    if (!fs.existsSync(DashboardDirPath)){
        fs.mkdirSync(DashboardDirPath, { recursive: true });
        console.log(`Directory creata: ${DashboardDirPath}`);
    }
    //Scrive il file page.tsx in /src/app/dashboard/page.tsx
    fs.writeFileSync(DashboardPageFilePath, DashboardPageContent);
    console.log(`[dashboard/page.tsx] File creato: ${DashboardPageFilePath}`);
}

function createStaffAdminApp(){
    const filePath = path.join(__dirname, 'src', 'app', '(private)', '(staff)', 'staff-admin');
    const pageFile = path.join(filePath, 'page.tsx');

    const content = `
export default function StaffPage(){
    return (
        <div className="flex justify-center items-center">
            <h1 className="text-4xl m-5">PAGINA STAFF USERS</h1>
        </div>
    )
}
    `;
    if(!fs.existsSync(filePath)){
        fs.mkdirSync(filePath, { recursive: true });
        console.log(`App creata con successo: ${filePath}`);
    }
    fs.writeFileSync(pageFile, content);
}

function createSuperuserSystemApp(){
    const filePath = path.join(__dirname, 'src', 'app', '(private)', '(superuser)', 'system');
    const pageFile = path.join(filePath, 'page.tsx');

    const content = `
export default function systemPage(){
    return (
        <div className="flex justify-center items-center">
            <h1 className="m-5 text-4xl">PAGINA SUPER USER ONLY</h1>
        </div>
    )
}
    `;
    if(!fs.existsSync(filePath)){
        fs.mkdirSync(filePath, { recursive: true });
        console.log(`App creata con successo: ${filePath}`);
    }
    fs.writeFileSync(pageFile, content);
}

function createPublicApp(){
    const filePath = path.join(__dirname, 'src', 'app', '(public)');

    if(!fs.existsSync(filePath)){
        fs.mkdirSync(filePath, { recursive: true });
        console.log("App Public creata con successo: ${filePath}");
    } else {
        console.log("L'app Public è già presente!")
    }
}



//DEFINIZIONE -> /modules/frontend_snipepts/middlware_protection.py
function middlewareServerProtection(){
    const middleware_path = path.join(__dirname, "src", "middleware.ts");
    const content = `import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';
import axios, { isAxiosError, AxiosResponse } from 'axios';

// Utilizziamo una cache in-memory per la chiave pubblica,
// così non dobbiamo fare una chiamata API ad ogni richiesta.
let publicKey: jose.CryptoKey | null = null;

// Tipizzazione della risposta della chiamata API per ottenere la chiave pubblica
interface PublicKeyResponse {
    public_key: string;
}

// Tipizzazione del payload del token JWT
interface TokenPayload extends jose.JWTPayload {
    is_staff: boolean;
    is_superuser: boolean;
}

async function getPublicKey(djangoApiUrl: string): Promise<jose.CryptoKey> {
    // 1. Aggiungi il controllo iniziale per la chiave pubblica
    if (publicKey) {
        return publicKey;
    }

    let response: AxiosResponse<PublicKeyResponse>;
    try {
        // 2. Esegui la chiamata API
        response = await axios.get<PublicKeyResponse>(\`\${djangoApiUrl}/api/v1/core/auth/public-key/\`, {
            headers: {
                'x-api-key': process.env.API_KEY
            }
        });

        // 3. Controlla che la risposta contenga la chiave pubblica
        if (!response.data || !response.data.public_key) {
            throw new Error("La risposta dell' API non contiene la chiave pubblica.");
        }

        // 4. Importa la chiave pubblica e memorizzala
        publicKey = await jose.importSPKI(response.data.public_key, 'RS256'); // RS256 ???? 
        return publicKey;

    } catch (error) {
        // 5. Gestisci l'errore in modo più specifico
        if (isAxiosError(error)) {
            console.error("Si è verificato il seguente errore durante la chiamata API: ", error.status, error.message);
        } else {
            console.error("Si è verificato un errore inaspettato: ", error);
        }
        // 6. Rilancia l'errore per gestirlo a livello superiore
        throw error;
    }
}

// Funzione di validazione locale del token
// Anche qui, modifichiamo il tipo di 'key' in 'any'
async function validateToken(token: string, key: CryptoKey): Promise<jose.JWTVerifyResult<TokenPayload> | null> {
    try {
        const verificationResult = await jose.jwtVerify<TokenPayload>(token, key, {
            algorithms: ['RS256'],
        });
        return verificationResult;
    } catch (e) {
        console.log("Token non valido o scaduto, necessita di refresh.");
        return null;
    }
}

export async function middleware(request: NextRequest) {
    const djangoApiUrl = process.env.DJANGO_API_URL || 'http://localhost:8000';
    const loginPage = '/login';

    const accessToken = request.cookies.get('access_token')?.value;
    const refreshToken = request.cookies.get('refresh_token')?.value;

    const protectedRoutes = ['/dashboard', '/change-password', '/settings', '/profile', '/staff-admin', '/system'];
    const isProtectedRoute = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route));

    const authRoutes = ['/login', '/register', '/reset-password'];
    const isAuthRoute = authRoutes.some(route => request.nextUrl.pathname.startsWith(route));

    const staffRoutes = ['/staff-admin']
    const isStaffRoute = staffRoutes.some(route => request.nextUrl.pathname.startsWith(route));
    
    const superuserRoutes = ['/system'];
    const isSuperuserRoute = superuserRoutes.some(route => request.nextUrl.pathname.startsWith(route));

    // Se l'utente non è autenticato e sta cercando di accedere a una rotta di autenticazione,
    // lasciagli continuare la navigazione.
    if (isAuthRoute && !refreshToken) {
        return NextResponse.next();
    }

    // Gestione della rotta radice ("/")
    if (request.nextUrl.pathname === '/') {
        // Se l'utente non è loggato (nessun refresh token), reindirizza a /login
        if (!refreshToken) {
            return NextResponse.redirect(new URL(loginPage, request.url));
        }
        // Se l'utente è loggato, reindirizza alla dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (isProtectedRoute) {
        // 1. Nessun token disponibile: reindirizza al login
        if (!accessToken && !refreshToken) {
            const response = NextResponse.redirect(new URL(loginPage, request.url));
            response.cookies.delete('refresh_token');
            response.cookies.delete('access_token');
            return response;
        }

        let pubKey: CryptoKey;
        try {
            pubKey = await getPublicKey(djangoApiUrl);
        } catch (error) {
            console.error(error);
            const response = NextResponse.redirect(new URL(loginPage, request.url));
            return response;
        }

        let payload: jose.JWTVerifyResult<TokenPayload> | null = null;
        if (accessToken) {
            payload = await validateToken(accessToken, pubKey);
        }

        if (!payload && refreshToken) {
            console.log("Access token scaduto, tento il refresh...");
            try {
                const refreshResponse = await axios.post(\`\${djangoApiUrl}/api/v1/user/token/refresh/\`, {
                    refresh: refreshToken,
                });

                const newTokens = refreshResponse.data;
                const response = NextResponse.next();
                response.cookies.set('access_token', newTokens.access, {
                    path: '/',
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                });
                response.cookies.set('refresh_token', newTokens.refresh, {
                    path: '/',
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                });

                payload = await validateToken(newTokens.access, pubKey);
                
                return response;
            } catch (error) {
                if (isAxiosError(error)) {
                    console.log(\`Refresh token non valido o scaduto (status: \${error.response?.status}). Reindirizzamento al login.\`);
                } else {
                    console.error("Errore imprevisto durante il refresh del token:", error);
                }
                
                const response = NextResponse.redirect(new URL(loginPage, request.url));
                response.cookies.delete('refresh_token');
                response.cookies.delete('access_token');
                return response;
            }
        }

        if (payload) {
            const { is_staff, is_superuser } = payload.payload;

            if (isStaffRoute && !is_staff && !is_superuser) {
                console.log("Accesso negato: utente non ha i permessi di staff.");
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }

            if (isSuperuserRoute && !is_superuser) {
                console.log("Accesso negato: l'utente non ha i permessi di superuser.");
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }

            return NextResponse.next();
        } else {
            const response = NextResponse.redirect(new URL(loginPage, request.url));
            response.cookies.delete('refresh_token');
            response.cookies.delete('access_token');
            return response;
        }
    }

    // Prosegui se la rotta non è protetta
    return NextResponse.next();
}

export const config = {
    // Il matcher deve includere tutte le rotte che il middleware deve intercettare.
    // Questo include sia le rotte protette che le rotte di autenticazione.
    matcher: ['/', '/login', '/reset-password', '/reset-password/:path*', '/dashboard', '/change-password', '/change-password:path*', '/dashboard/:path*', '/settings/:path*', '/profile/:path*', '/staff-admin/:path*', '/system/:path*'],
};
 
    `;
    fs.writeFileSync(middleware_path, content);
}



//DEFINIZIONE -> /modules/frontend_snipepts/BFF_API/user_preferences_api.py
function bffThemeApi(){
    const dirPath = path.join(__dirname, 'src', 'app', 'api', 'theme');

    if(!fs.existsSync(dirPath)){
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`Directory creata: ${dirPath}`);
        } else {
            console.log(`Il file esiste già: ${dirPath}`);
        }

    const filePath = path.join(dirPath, 'route.ts');

    const content = `
import { apiServer } from "@/lib/axios-server";
import axios from "axios";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
    const accessToken = (await cookies()).get('access_token')?.value;

    if (!accessToken) {
        return NextResponse.json({ error: 'Token non trovato nei cookie' }, { status: 401 });
    }

    try {
        // Legge il body della richiesta in entrata dal frontend
        const payload = await request.json();
        const { theme } = payload;

        // Inoltra la richiesta PUT al backend Django
        const djangoResponse = await apiServer.put('api/v1/user/theme-preferences/', payload, {
            headers: {
                'Authorization': \`Bearer \${accessToken}\`,
            },
        });

        // Crea la risposta di successo
        const response = NextResponse.json(djangoResponse.data, { status: djangoResponse.status });

        return response;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            // Se Axios ha un errore di risposta, inoltra l'errore al client
            return NextResponse.json(error.response.data, {
                status: error.response.status,
            });
        }

        console.error("Errore durante l'aggiornamento del tema:", error);
        return NextResponse.json(
            { error: 'Errore interno del server.' },
            { status: 500 }
        );
    }
}
    
    `;

    fs.writeFileSync(filePath, content);
}
 

//DEFINIZIONE -> /modules/frontend_snipepts/BFF_API/auth_api.py
function createApiDirs(){
    // API DIRECTORY
    const apiDirPath = path.join(__dirname, 'src', 'app', 'api');

    if(!fs.existsSync(apiDirPath)){
        fs.mkdirSync(apiDirPath, { recursive: true });
        console.log(`Directory creata: ${apiDirPath}`);
    } else {
        console.log(`Il file esiste già: ${apiDirPath}`);
    }
}

function createApiAuthDir(){


    //AUTH DIRECTORY GENERALE

    const authPath = path.join(__dirname, 'src', 'app', 'api', 'auth');

    if(!fs.existsSync(authPath)){
        fs.mkdirSync(authPath, { recursive: true });
        console.log(`Directory creata: ${authPath}`);
    } else {
        console.log(`Il file esiste già: ${authPath}`);
    }

    
    //LOGIN AUTH E FILE
    
    const loginDir = path.join(authPath, 'login');
    if(!fs.existsSync(loginDir)){
        fs.mkdirSync(loginDir, { recursive: true });
        console.log(`Directory creata: ${loginDir}`);
    } else {
        console.log(`Il file esiste già: ${loginDir}`);
    }
    
    const loginRoute = path.join(loginDir, 'route.ts');
    loginContent = `import { NextResponse } from 'next/server';
import axios from 'axios';
import { apiServer } from '@/lib/axios-server';


export async function POST(request: Request) {
    try {
        //Credenziali inserite dall'utente ottenute dalla richiesta utente e parsate in json()
        const credentials = await request.json(); // il metodo .json() legge il body della richiesta e ritorna una Promise che si risolve con il risultato dell'analisi di JSON come input per produrre un oggetto JavaScript.

        // Utilizza Axios per inoltrare la richiesta di login al backend Django.
        const djangoResponse = await apiServer.post('api/v1/user/login/', credentials);

        // Se il login ha successo, crea una nuova risposta per il client Next.js.
        const response = NextResponse.json(djangoResponse.data); //Restituisce un oggetto JSON contenente principalmente un HTTP status code

        // Axios memorizza i cookie in un array sotto l'header 'set-cookie'.
        // Memorizziamo in una variabile i cookies che otteniamo da django, accedendo all'header set-cookie che può contenere più elementi
        // (access_token e refresh_token), quindi spesso viene gestito come array
        const setCookieHeaders = djangoResponse.headers['set-cookie']; //contiene l'header della risposta http compresi i token

        if (setCookieHeaders) {
            // Iteriamo su ogni cookie ricevuto e lo appendiamo all'header di risposta che verrà inoltrato al client, dove verranno salvati nel browser
            setCookieHeaders.forEach(cookieString => {
                // Imposta ogni cookie direttamente usando il metodo di Next.js.
                // Questo inoltra i cookie così come sono arrivati da Django.
                response.headers.append('Set-Cookie', cookieString);
            });
        }

        // Se l'header dei cookie non è presente, c'è un problema nel backend
        if (!setCookieHeaders) {
            console.error("L'header 'Set-Cookie' non è presente nella risposta di Django. Controlla la configurazione dei cookie nel backend.");
        }

        return response;

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            // Se Axios ha un errore di risposta (es. 400 Bad Request),
            // inoltra l'errore al client.
            return new NextResponse(JSON.stringify(error.response.data), {
                status: error.response.status,
            });
        }

        console.error("Errore durante il login:", error);
        return new NextResponse(
            JSON.stringify({ error: 'Errore interno del server.' }),
            { status: 500 }
        );
    }
}
    `;

    fs.writeFileSync(loginRoute, loginContent);
    

    // LOGOUT DIRECTORY E FILE

    const logoutDir = path.join(authPath, 'logout');
    if(!fs.existsSync(logoutDir)){
        fs.mkdirSync(logoutDir, { recursive: true });
        console.log(`Directory creata: ${logoutDir}`);
    } else {
        console.log(`Il file esiste già: ${logoutDir}`);
    }

    const logoutRoute = path.join(logoutDir, 'route.ts');
    logoutContent = `import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { apiServer } from '@/lib/axios-server';



export async function POST(request: Request) {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;

    const response = NextResponse.json({ message: "Logout effettuato con successo" });

    if (refreshToken) {
        try {
            // Inoltra la richiesta di logout a Django usando Axios
            await apiServer.post('api/v1/user/logout/', { refresh: refreshToken });
        } catch (error) {
            // Gestisce gli errori specifici di Axios.
            if (axios.isAxiosError(error)) {
                // Se c'è un errore nella risposta di Django (es. 401),
                // lo logghiamo ma procediamo comunque con il logout lato client.
                console.error("Errore da Django durante la chiamata di logout:", error.response?.data);
            } else {
                console.error("Errore sconosciuto durante la chiamata di logout:", error);
            }
            // Nonostante l'errore, procediamo con la pulizia dei cookie lato client
        }
    }

    // Indipendentemente dal successo della chiamata a Django,
    // eliminiamo i cookie per forzare il logout lato client.
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');

    return response;
}
    `;
    fs.writeFileSync(logoutRoute, logoutContent);


    //USER INFO ENDPOINT

    const userDir = path.join(authPath, 'user');

    if(!fs.existsSync(userDir)){
        fs.mkdirSync(userDir, { recursive: true });
        console.log(`Directory creata: ${userDir}`);
    } else {
        console.log(`Il file esiste già: ${userDir}`);
    }

    const userRoute = path.join(userDir, 'route.ts');
    
    const userContent = `import { NextResponse } from "next/server";
import axios from "axios";
import { cookies } from "next/headers";
import { apiServer } from "@/lib/axios-server";


export async function GET(){
    try{

        const cookieStore = await cookies()
        const accessToken = cookieStore.get('access_token')?.value;

        if (!accessToken) {
            return NextResponse.json(
                { error: 'Access token mancante' },
                { status: 401 }
            );
        }

        const response = await apiServer.get('api/v1/user/user/', {
            headers: {
                'Authorization': \`Bearer \${accessToken}\`,
            },
        });
        return NextResponse.json(response.data, { status: 200 });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            return NextResponse.json(
                { error: error.response?.data || 'Errore da Django' },
                { status: error.response?.status || 500 }
            );
        }
        // Gestione di altri tipi di errore
        return NextResponse.json(
            { error: 'Errore sconosciuto' },
            { status: 500 }
        );
    }
}
    `;

    fs.writeFileSync(userRoute, userContent);
}

function passwordChangeApi(){
    const dirPath = path.join(__dirname, 'src', 'app', 'api', 'auth', 'password-change');

    if(!fs.existsSync(dirPath)){
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Directory creata: ${dirPath}`);
    } else {
        console.log(`Il file esiste già: ${dirPath}`);
    }

    const filePath = path.join(dirPath, 'route.ts');

    const content = `
import { NextResponse } from 'next/server';
import axios from 'axios';
import { cookies } from 'next/headers';
import { apiServer } from "@/lib/axios-server";


export async function POST(request: Request){
    try {
        // console.log('HEADER DELLA RICHIESTA: ', request.headers);
        const payload = await request.json();

        //Leggi il cookie e inoltralo con la richiesta
        const accessToken = (await cookies()).get('access_token')?.value;

        if (!accessToken){
            return new NextResponse(JSON.stringify({error: 'Token non trovato nei cookie'}), {status: 401});
        }
        
        const djangoResponse = await apiServer.post('api/v1/user/password/change/', payload, {
            headers: {
                'Authorization': \`Bearer \${accessToken}\`,
            },
        });


        //Risposta per il client 
        const response = NextResponse.json(djangoResponse.data);

        return response;
    } catch (error){
        if (axios.isAxiosError(error) && error.response) {
            // Se Axios ha un errore di risposta (es. 400 Bad Request),
            // inoltra l'errore al client.
            return new NextResponse(JSON.stringify(error.response.data), {
                status: error.response.status,
            });
        }

        console.error("Errore durante il login:", error);
        return new NextResponse(
            JSON.stringify({ error: 'Errore interno del server.' }),
            { status: 500 }
        );
    }
}
    `;
    fs.writeFileSync(filePath, content);
}

function passwordResetApi(){
    const dirPath = path.join(__dirname, 'src', 'app', 'api', 'auth', 'password-reset');
    
    if(!fs.existsSync(dirPath)){
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Directory creata: ${dirPath}`);
    } else {
        console.log(`Il file esiste già: ${dirPath}`);
    }
    
    const filePath = path.join(dirPath, "route.ts");

    const content = `
import { NextResponse } from 'next/server';
import axios from 'axios';
import { apiServer } from "@/lib/axios-server";


export async function POST(request: Request) {
    try{
        const payload = await request.json();

        const djangoResponse = await apiServer.post('api/v1/user/password/reset/', payload);

        const response = NextResponse.json(djangoResponse.data);

        return response;

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            // Se Axios ha un errore di risposta (es. 400 Bad Request),
            // inoltra l'errore al client.
            return new NextResponse(JSON.stringify(error.response.data), {
                status: error.response.status,
            });
        }

        console.error("Errore durante il login:", error);
        return new NextResponse(
            JSON.stringify({ error: 'Errore interno del server.' }),
            { status: 500 }
        );
    }
}
    `;
    fs.writeFileSync(filePath, content);
}

function passwordResetConfirmApi(){
    const dirPath = path.join(__dirname, 'src', 'app', 'api', 'auth', 'password-reset', 'confirm');

    if(!fs.existsSync(dirPath)){
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Directory creata: ${dirPath}`);
    } else {
        console.log(`Il file esiste già: ${dirPath}`);
    }
    
    const filePath = path.join(dirPath, 'route.ts');

    const content = `
import { NextResponse } from 'next/server';
import axios from 'axios';
import { apiServer } from "@/lib/axios-server";


export async function POST(request: Request) {
    try {
        const payload = await request.json();

        const djangoResponse = await apiServer.post('api/v1/user/password/reset/confirm/', payload);

        const response = NextResponse.json(djangoResponse.data);

        return response;

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            // Se Axios ha un errore di risposta (es. 400 Bad Request),
            // inoltra l'errore al client.
            return new NextResponse(JSON.stringify(error.response.data), {
                status: error.response.status,
            });
        }

        console.error("Errore durante il login:", error);
        return new NextResponse(
            JSON.stringify({ error: 'Errore interno del server.' }),
            { status: 500 }
        );
    }
}
    `;
    fs.writeFileSync(filePath, content);
}

function deleteShadcnLoginDir(){
  const dirPath = path.join(__dirname, "src", "app", "login");

  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`Directory e file in "${dirPath}" eliminati con successo!`);
  } else {
    console.log(`La directory "${dirPath}" non esiste. Nessuna azione necessaria.`);
  }
}


//DEFINIZIONE -> /modules/frontend_snippets/components/Breadcrumb.py
function createCustomBreadCrumb(){
    const filePath = path.join(__dirname, 'src', 'components', 'Breadcrumb.tsx');

    const content = `'use client';

import { usePathname } from 'next/navigation';
import {
    Breadcrumb as BreadcrumbComponent,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from './ui/breadcrumb';

export default function Breadcrumb() {
    const pathname = usePathname();
    const pathSegments = pathname.split('/').filter(Boolean); // Dividiamo l'URL in segmenti

    return (
        <BreadcrumbComponent>
            <BreadcrumbList>
                {pathSegments.map((segment, index) => {
                    const href = \`/\${pathSegments.slice(0, index + 1).join('/')}\`;
                    const isLast = index === pathSegments.length - 1;
                    const segmentTitle = segment.charAt(0).toUpperCase() + segment.slice(1);

                    return (
                        <div key={href} className="flex items-center">
                            <BreadcrumbItem className="hidden md:block">
                                {isLast ? (
                                    <BreadcrumbPage>{segmentTitle}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink href={href}>
                                        {segmentTitle}
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
                        </div>
                    );
                })}
            </BreadcrumbList>
        </BreadcrumbComponent>
    );
}
    `;
    fs.writeFileSync(filePath, content);
}


//DEFINIZIONE -> /modules/frontend_snippets/frontend_services.py
function createServicesDir(){
    const servicePath = path.join(__dirname, "src", "services");

    //Crea le directories
    if(!fs.existsSync(servicePath)){
      fs.mkdirSync(servicePath, { recursive: true });
      console.log(`Directory creata: ${servicePath}`);
    } else {
      console.log(`Directory già esistente: ${servicePath}`);
    }
}

function createAuthServiceFile(){
    const AuthServicePath = path.join(__dirname, "src", "services", "auth.service.ts");

    const content = `import { api } from '@/lib/axios';
import { LoginCredentials, ConfirmResetPayload, ChangePasswordPayload } from '@/types';

// Definiamo l'interfaccia User qui per coerenza, anche se presente in authStore.
// In un refactoring futuro, potrebbe essere spostata in un file di tipi dedicato.
interface User {
    pk: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
}

/**
 * Esegue il login dell'utente.
 * @param credentials - Oggetto con username e password.
 * @returns I dati dell'utente.
 */
export const login = async (credentials: LoginCredentials): Promise<User> => {
    const response = await api.post<User>('/auth/login/', credentials);
    return response.data;
};

/**
 * Esegue il logout dell'utente.
 * Invia una richiesta al backend per invalidare il refresh token (se HttpOnly).
 */
export const logout = async (): Promise<void> => {
    // Il backend dovrebbe invalidare il cookie di sessione/token.
    await api.post('/auth/logout/');
};

/**
 * Richiede un reset della password per un'email.
 * @param email - L'email dell'utente.
 */
export const requestPasswordReset = async (email: string): Promise<void> => {
    await api.post('/auth/password-reset/', { email });
};

/**
 * Conferma il reset della password con il nuovo token.
 * @param payload - Dati per la conferma del reset.
 */
export const confirmPasswordReset = async (payload: ConfirmResetPayload): Promise<void> => {
    await api.post('/auth/password-reset/confirm/', payload);
};

/**
 * Cambia la password dell'utente autenticato.
 * @param payload - Dati per il cambio password.
 */
export const changePassword = async (payload: ChangePasswordPayload): Promise<void> => {
    await api.post('/auth/password-change/', payload);
};

/**
 * Recupera i dati dell'utente attualmente autenticato.
 * @returns I dati dell'utente.
 */
export const getMe = async (): Promise<User> => {
    const response = await api.get<User>('/auth/user/');
    return response.data;
};
    `
    fs.writeFileSync(AuthServicePath, content);
    console.log(`File 'auth.service.ts' creato correttamente`);
}


//DEFINIZIONE -> /modules/frontend_snippets/modules_generator.py
function createModulesDir(){
    const modulesDirPath = path.join(__dirname, 'src', 'modules');

    if(!fs.existsSync(modulesDirPath)){
        fs.mkdirSync(modulesDirPath, { recursive: true });
        console.log("Directory Modules/ creata: ${modulesDirPath}");
    } else {
        console.log("Directory Modules/ già esistente!");
    }
}


async function createModuleStructure(baseDir, subDirs) {
    try {
        // 1. Crea la directory base (in modo ricorsivo, es. 'src/modules/dashboard')
        await mkdir(baseDir, { recursive: true });
        console.log(`[OK] Directory base creata: ${baseDir}`);

        // 2. Crea le sottodirectory interne
        for (const subDir of subDirs) {
            const fullPath = path.join(baseDir, subDir);

            // Crea la sottodirectory (l'opzione recursive non è strettamente necessaria qui
            // perché baseDir esiste, ma è una buona prassi per sicurezza).
            await mkdir(fullPath, { recursive: true });
            console.log(`  [+] Sottodirectory creata: ${fullPath}`);
        }
    } catch (error) {
        // Gestione degli errori, ad esempio permessi insufficienti o altri problemi.
        if (error.code === 'EEXIST') {
            console.warn(`[WARN] Directory già esistente. Saltata la creazione di: ${baseDir}`);
        } else {
            console.error(`[ERROR] Errore durante la creazione di ${baseDir}:`, error.message);
        }
    }
}

/**
 * Funzione di esecuzione principale che chiama la logica per ogni modulo.
 */
async function mainModulesGenerator() {
    // Direttori base (parent) per tutti i moduli
    const BASE_PATH = 'src/modules';

    // Struttura interna comune per tutti i moduli (dashboard, superuser, etc.)
    const INTERNAL_DIRS = ['hooks', 'utils'];

    // Elenco dei moduli da creare all'interno di BASE_PATH
    const MODULES = ['dashboard', 'superuser', 'staff', 'public'];

    console.log("--- Avvio creazione struttura Next.js Modules ---");

    for (const moduleName of MODULES) {
        // Costruisce il percorso completo per il modulo (e.g., 'src/modules/dashboard')
        const modulePath = path.join(BASE_PATH, moduleName);

        // Chiama la funzione riutilizzabile con i parametri definiti
        await createModuleStructure(modulePath, INTERNAL_DIRS);
        console.log('-------------------------------------------');
    }

    console.log("--- Struttura directory completata con successo! ---");
}



//ESECUZIONE delle funzioni /misc_generator.py
// Esegui le funzioni per creare i file e configurare l'ambiente
createAxiosInstanceFile(); // Chiama la funzione per creare il file axios.ts
generateAxiosServerInstanceCode();
createQueryClientFile(); // Chiama la funzione per creare il file queryClient.ts
createProvidersFile(); // Chiama la funzione per creare il file providers.tsx
createHooksDirectory(); // Chiama la funzione per creare la cartella hooks
createLayoutFile(); // Chiama la funzione per creare il file layout.tsx
createTypesDirectory(); // Chiama la funzione per creare la cartella types
createPrivateDir();
createGuestDir();
createEnvLocalFile(); // Chiama la funzione per creare il file .env.local
fixHMR(); // Chiama la funzione per risolvere il problema di HMR
createImageDir();
overwriteGlobalPage();
createPrivateLayout();
createLoginClientComponent();

createUtilsGlobal();

generateEnvLocalExample();


console.log('Tutti i file di configurazione frontend creati con successo!');



//ESECUZIONE delle funzioni /app_generator.py
//Esegui le funzioni per creare i file riguardanti le app che compongono il frontend e i loro files
createAuthDirectory();
createDashboardApp();
createStaffAdminApp();
createSuperuserSystemApp();
createPublicApp();




//ESECUZIONE delle funzioni /auth_files.py
function executeAuthFunctions() {

  overwriteLoginForm();
  createAuthts();
  generateLayoutResetPswConfirm();
  generateResetDirsFiles();
  generateStoreDirAndFile();
  deleteShadcnLoginDir();
}

executeAuthFunctions();



//ESECUZIONE delle funzioni /middleware_protection.py
middlewareServerProtection();



//ESECUZIONE /modules/frontend_snippets/BFF_API/
bffThemeApi();


//ESECUZIONE /modules/frontend_snippets/BFF_API/auth_api.py
createApiDirs();
createApiAuthDir();
passwordChangeApi();
passwordResetApi();
passwordResetConfirmApi();


//ESECUZIONE /modules/frontend_snippets/components/execute_components_code.py
createCustomBreadCrumb();


//ESECUZIONE -> /modules/frontend_snippets/frontend_services.py
createServicesDir();
createAuthServiceFile();


//ESECUZIONE -> /modules/frontend_snippets/modules_generator.py
createModulesDir();

(async () => {
    await mainModulesGenerator();
})();


