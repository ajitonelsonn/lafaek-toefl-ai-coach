"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BellRing, Globe, LogOut, Moon, Trash2, Volume2 } from "lucide-react";
import { BACKGROUNDS } from "@/lib/config/assets";
import { resetDemo, updateDemo, useDemoState, useHydrated, type DemoState, type ThemePreference } from "@/lib/store/demo-store";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Toggle";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { LoadingState } from "@/components/ui/States";
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
  const hydrated = useHydrated();
  const { settings, user } = useDemoState();
  if (!hydrated) return <LoadingState label="Loading settings…" />;
  return <SettingsEditor key={JSON.stringify(settings)} saved={settings} signedIn={!!user} />;
}

function SettingsEditor({ saved, signedIn }: { saved: DemoState["settings"]; signedIn: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState(saved);
  const [confirm, setConfirm] = useState<"logout" | "reset" | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const save = () => {
    updateDemo((s) => ({ ...s, settings: draft }));
    toast("Settings saved.");
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
                onChange={(e) => setDraft((d) => ({ ...d, theme: e.target.value as ThemePreference }))}
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "Same as my device" },
                ]}
                containerClassName="sm:w-48"
              />
            }
          />
          <Row
            id="sound-label"
            icon={<Volume2 />}
            title="Sound"
            description="Play audio during practice."
            control={<Toggle checked={draft.sound} onChange={(v) => setDraft((d) => ({ ...d, sound: v }))} label="Sound during practice" />}
          />
          <Row
            id="remind-label"
            icon={<BellRing />}
            title="Study reminders"
            description="Email reminders are not connected yet. Your choice is saved for later."
            control={<Toggle checked={draft.reminders} onChange={(v) => setDraft((d) => ({ ...d, reminders: v }))} label="Study reminders" />}
          />
          <div className="mt-4 flex flex-wrap justify-end gap-3">
            {dirty && <span className="mr-auto self-center text-sm text-warning">You have unsaved changes.</span>}
            <Button variant="secondary" disabled={!dirty} onClick={() => setDraft(saved)}>
              Cancel
            </Button>
            <Button disabled={!dirty} onClick={save}>
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
            description={signedIn ? "End your demo session on this device." : "You are not signed in."}
            control={
              <Button variant="secondary" disabled={!signedIn} onClick={() => setConfirm("logout")}>
                Log out
              </Button>
            }
          />
          <Row
            id="reset-label"
            icon={<Trash2 />}
            title="Reset demo data"
            description="Delete practice history, study plan, vocabulary progress and drafts saved in this browser."
            control={
              <Button variant="danger" onClick={() => setConfirm("reset")}>
                Reset data
              </Button>
            }
          />
        </Card>
      </div>
      <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-line bg-[#eef4ff] xl:block">
        <Image src={BACKGROUNDS.settings.src} alt="" width={BACKGROUNDS.settings.width} height={BACKGROUNDS.settings.height} className="h-auto w-full" />
      </div>

      <ConfirmDialog
        open={confirm === "logout"}
        title="Log out?"
        description="You can log in again at any time. Your progress stays in this browser."
        confirmLabel="Log out"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          updateDemo((s) => ({ ...s, user: null }));
          toast("You have been logged out of the demo.", "info");
          router.push("/login");
        }}
      />
      <ConfirmDialog
        open={confirm === "reset"}
        title="Reset all demo data?"
        description="This deletes your practice history, study plan, vocabulary progress and drafts in this browser. This cannot be undone."
        confirmLabel="Reset data"
        tone="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          resetDemo(true);
          toast("Demo data has been reset.", "info");
        }}
      />
    </div>
  );
}
