import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import quantivaLogo from "@/assets/Quantum Explorer Logo.png";
import MoleculeBackground from "@/components/MoleculeBackground";

const Login: React.FC = () => {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      nav("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 relative">
      <div className="absolute inset-0 -z-10">
        <MoleculeBackground />
      </div>
      <Card className="w-full max-w-lg relative z-10">
        <CardHeader>
          <div className="flex items-center gap-4">
            <img src={quantivaLogo} alt="Quantiva" className="h-10 w-10 rounded-md" />
            <div>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Access your saved experiments and simulation history</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div>
              <label className="text-sm mb-1 block">Email</label>
              <Input required value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
            <div>
              <label className="text-sm mb-1 block">Password</label>
              <Input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <CardFooter className="gap-2 justify-between">
              <div className="text-sm">
                Don't have an account? <Link to="/signup" className="text-primary underline">Create one</Link>
              </div>
              <div>
                <Button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
              </div>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
