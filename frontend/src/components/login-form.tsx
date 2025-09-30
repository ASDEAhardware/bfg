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
 
