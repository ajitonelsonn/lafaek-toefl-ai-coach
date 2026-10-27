"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Camera } from "lucide-react";
import { BACKGROUNDS } from "@/lib/config/assets";
import { updateDemo, useDemoState, useHydrated } from "@/lib/store/demo-store";
import { initials } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { LoadingState } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";

export function ProfileForm() {
  const hydrated = useHydrated();
  const { user } = useDemoState();
  if (!hydrated) return <LoadingState label="Loading profile…" />;
  if (!user) {
    return (
      <Card className="text-center">
        <p className="text-body">You are browsing the demo without signing in.</p>
        <p className="mt-1 text-sm text-muted">Sign in (demo) to set your name.</p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Log in
          </Link>
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Sign up
          </Link>
        </div>
      </Card>
    );
  }
  return <ProfileEditor key={user.email} name={user.name} email={user.email} />;
}

function ProfileEditor({ name: savedName, email }: { name: string; email: string }) {
  const toast = useToast();
  const [name, setName] = useState(savedName);
  const [error, setError] = useState("");
  const dirty = name.trim() !== savedName;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Please enter at least 2 letters.");
      return;
    }
    setError("");
    updateDemo((s) => (s.user ? { ...s, user: { ...s.user, name: name.trim() } } : s));
    toast("Profile saved.");
  };

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="grid md:grid-cols-[minmax(0,1fr)_260px]">
        <form onSubmit={save} noValidate className="p-6 sm:p-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <span className="inline-flex size-32 items-center justify-center rounded-full bg-primary text-5xl font-bold text-on-primary" aria-hidden>
                  {initials(name || savedName)}
                </span>
                <button
                  type="button"
                  disabled
                  title="Photo upload will be available when file storage is connected."
                  aria-label="Change photo (not available yet)"
                  className="absolute bottom-1 right-1 inline-flex size-10 cursor-not-allowed items-center justify-center rounded-full border border-line bg-surface text-muted shadow"
                >
                  <Camera className="size-5" />
                </button>
              </div>
              <p className="text-xl font-bold text-ink">{savedName}</p>
              <StatusBadge tone="primary">Free & open source</StatusBadge>
              <p className="max-w-40 text-center text-xs text-muted">Photo upload comes later.</p>
            </div>
            <div className="flex w-full flex-1 flex-col gap-5">
              <Input label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={error} />
              <Input label="Email" value={email} readOnly disabled hint="To change your email, contact the site administrator." />
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-line pt-5">
            <Button variant="secondary" disabled={!dirty} onClick={() => { setName(savedName); setError(""); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={!dirty}>
              Save Changes
            </Button>
          </div>
        </form>
        <div className="hidden bg-[#eef4ff] md:block">
          <Image src={BACKGROUNDS.profile.src} alt="" width={BACKGROUNDS.profile.width} height={BACKGROUNDS.profile.height} className="h-full w-full object-cover" />
        </div>
      </div>
    </Card>
  );
}
