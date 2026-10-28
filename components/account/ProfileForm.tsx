"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { Camera } from "lucide-react";
import { BACKGROUNDS } from "@/lib/config/assets";
import { useSession } from "@/components/session/SessionProvider";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { formatDate, initials } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";

export function ProfileForm({ planLabel }: { planLabel: string }) {
  const { user } = useSession();
  return <ProfileEditor key={user.email} name={user.name} email={user.email} planLabel={planLabel} memberSince={user.createdAt} />;
}

function ProfileEditor({ name: savedName, email, planLabel, memberSince }: { name: string; email: string; planLabel: string; memberSince: string }) {
  const toast = useToast();
  const { user, setUser } = useSession();
  const [name, setName] = useState(savedName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== savedName;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Please enter at least 2 letters.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const r = await api<{ profile: { name: string } }>("/api/profile", { method: "PATCH", body: { name: name.trim() } });
      setUser({ ...user, name: r.profile.name });
      toast("Profile saved.");
    } catch (err) {
      setError(err instanceof ApiClientError && err.fields?.name ? err.fields.name : errorMessage(err));
    } finally {
      setSaving(false);
    }
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
                  title="Photo upload is not available yet."
                  aria-label="Change photo (not available yet)"
                  className="absolute bottom-1 right-1 inline-flex size-10 cursor-not-allowed items-center justify-center rounded-full border border-line bg-surface text-muted shadow"
                >
                  <Camera className="size-5" />
                </button>
              </div>
              <p className="text-xl font-bold text-ink">{savedName}</p>
              <StatusBadge tone="primary">{planLabel}</StatusBadge>
              {memberSince && <p className="text-xs text-muted">Member since {formatDate(memberSince)}</p>}
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
            <Button type="submit" disabled={!dirty} loading={saving}>
              Save Changes
            </Button>
          </div>
        </form>
        <div className="hidden items-center bg-[#eef4ff] p-5 md:flex">
          <Image src={BACKGROUNDS.profile.src} alt="" width={BACKGROUNDS.profile.width} height={BACKGROUNDS.profile.height} sizes="220px" className="h-auto w-full rounded-2xl shadow-sm" />
        </div>
      </div>
    </Card>
  );
}
