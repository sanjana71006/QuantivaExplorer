import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import quantivaLogo from "@/assets/Quantum Explorer Logo.png";

const Signup: React.FC = () => {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup(name, email, password);
      nav("/");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-4">
            <img src={quantivaLogo} alt="Quantiva" className="h-10 w-10 rounded-md" />
            <div>
              <CardTitle>Create an account</CardTitle>
              <CardDescription>Save experiments, configurations and simulation history</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div>
              <label className="text-sm mb-1 block">Name</label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
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
                Already have an account? <Link to="/login" className="text-primary underline">Sign in</Link>
              </div>
              <div>
                <Button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</Button>
              </div>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
