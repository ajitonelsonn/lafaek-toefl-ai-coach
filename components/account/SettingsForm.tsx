"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BellRing, Globe, LogOut, Mic, Moon, Trash2, Volume2 } from "lucide-react";
import { BACKGROUNDS } from "@/lib/config/assets";
import { api, errorMessage } from "@/lib/client/api";
import { useSession, type UserSettings } from "@/components/session/SessionProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Toggle";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";

function Row({ icon, title, description, control, id }: { icon: ReactNode; title: string; description: ReactNode; control: ReactNode; id: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-line py-5 last:border-0">
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary [&>svg]:size-6" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p id={id} className="font-bold text-ink">
          {title}
        </p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <div className="w-full sm:w-auto">{control}</div>
    </div>
  );
}

export function SettingsForm() {
  const { settings } = useSession();
  return <SettingsEditor key={JSON.stringify(settings)} saved={settings} />;
}

function SettingsEditor({ saved }: { saved: UserSettings }) {
  const router = useRouter();
  const toast = useToast();
  const { setSettings } = useSession();
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<"logout" | "delete" | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const save = async () => {
    setSaving(true);
    try {
      const r = await api<{ settings: UserSettings }>("/api/settings", { method: "PATCH", body: draft });
      setSettings(r.settings);
      toast("Settings saved.");
    } catch (e) {
      toast(errorMessage(e), "warning");
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    setConfirm(null);
    try {
      await api("/api/auth/logout", { method: "POST", body: {} });
      router.replace("/login");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "warning");
    }
  };

  const deleteAccount = async () => {
    try {
      await api("/api/account", { method: "DELETE", body: { confirm: "DELETE" } });
      setConfirm(null);
      router.replace("/");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "warning");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card as="section" aria-labelledby="pref-title">
          <h2 id="pref-title" className="text-lg font-bold text-ink">
            Preferences
          </h2>
          <Row
            id="lang-label"
            icon={<Globe />}
            title="Language"
            description="The app is in English. More languages may come later."
            control={<Select label="Language" srOnlyLabel value="en" disabled options={[{ value: "en", label: "English" }]} containerClassName="sm:w-48" />}
          />
          <Row
            id="theme-label"
            icon={<Moon />}
            title="Theme"
            description="Choose how the app looks."
            control={
              <Select
                label="Theme"
                srOnlyLabel
                value={draft.theme}
                onChange={(e) => setDraft((d) => ({ ...d, theme: e.target.value as UserSettings["theme"] }))}
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "Same as my device" },
                ]}
                containerClassName="sm:w-48"
              />
            }
          />
          <Row id="sound-label" icon={<Volume2 />} title="Sound" description="Play audio during practice." control={<Toggle checked={draft.sound} onChange={(v) => setDraft((d) => ({ ...d, sound: v }))} label="Sound during practice" />} />
          <Row
            id="recording-label"
            icon={<Mic />}
            title="Keep my speaking recordings"
            description="Off: recordings are deleted right after transcription. On: they are stored privately so you can review them later (requires media storage)."
            control={<Toggle checked={draft.recordingConsent} onChange={(v) => setDraft((d) => ({ ...d, recordingConsent: v }))} label="Keep speaking recordings" />}
          />
          <Row
            id="remind-label"
            icon={<BellRing />}
            title="Study reminders"
            description="Reminder emails are not sent yet. Your choice is saved for when they are."
            control={<Toggle checked={draft.reminders} onChange={(v) => setDraft((d) => ({ ...d, reminders: v }))} label="Study reminders" />}
          />
          <div className="mt-4 flex flex-wrap justify-end gap-3">
            {dirty && <span className="mr-auto self-center text-sm text-warning">You have unsaved changes.</span>}
            <Button variant="secondary" disabled={!dirty} onClick={() => setDraft(saved)}>
              Cancel
            </Button>
            <Button disabled={!dirty} loading={saving} onClick={() => void save()}>
              Save Changes
            </Button>
          </div>
        </Card>

        <Card as="section" aria-labelledby="account-title">
          <h2 id="account-title" className="text-lg font-bold text-ink">
            Account
          </h2>
          <Row
            id="logout-label"
            icon={<LogOut />}
            title="Log out"
            description="End your session on this device."
            control={
              <Button variant="secondary" onClick={() => setConfirm("logout")}>
                Log out
              </Button>
            }
          />
          <Row
            id="delete-label"
            icon={<Trash2 />}
            title="Delete account"
            description="Permanently delete your account, study plan, practice history and stored media."
            control={
              <Button variant="danger" onClick={() => setConfirm("delete")}>
                Delete account
              </Button>
            }
          />
        </Card>
      </div>
      <div className="hidden self-start overflow-hidden rounded-[var(--radius-card)] border border-line bg-[#eef4ff] xl:block">
        <Image src={BACKGROUNDS.settings.src} alt="" width={BACKGROUNDS.settings.width} height={BACKGROUNDS.settings.height} sizes="300px" className="h-auto w-full" />
      </div>

      <ConfirmDialog open={confirm === "logout"} title="Log out?" description="You can log in again at any time." confirmLabel="Log out" onCancel={() => setConfirm(null)} onConfirm={() => void logout()} />
      <ConfirmDialog
        open={confirm === "delete"}
        title="Delete your account?"
        description="This permanently deletes your account and all your data. It cannot be undone."
        confirmLabel="Delete account"
        tone="danger"
        onCancel={() => {
          setConfirm(null);
          setDeleteText("");
        }}
        onConfirm={() => (deleteText === "DELETE" ? void deleteAccount() : toast("Type DELETE to confirm.", "warning"))}
      >
        <Input label="Type DELETE to confirm" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoComplete="off" />
      </ConfirmDialog>
    </div>
  );
}
