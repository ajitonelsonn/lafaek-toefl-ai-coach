"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { icon3dSrc, VR_ASSETS } from "@/lib/config/assets";
import { formatDate, formatRelative } from "@/lib/utils/format";
import type { DeviceKind } from "@/lib/utils/user-agent";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon3D } from "@/components/ui/Icon3D";
import { useToast } from "@/components/ui/Toast";

interface Device {
  id: string;
  label: string;
  kind: DeviceKind;
  current: boolean;
  signedInAt: string;
  lastActiveAt: string;
}

const KIND_ICON: Record<DeviceKind, { src: string; width: number; height: number }> = {
  vr: VR_ASSETS.vr,
  computer: VR_ASSETS.desktop,
  phone: { src: icon3dSrc("phone"), width: 65, height: 65 },
  unknown: { src: icon3dSrc("website"), width: 65, height: 65 },
};

/** Settings: the devices signed in to this account (up to 3), with Sign out for each. */
export function DevicesCard() {
  const toast = useToast();
  const [data, setData] = useState<{ max: number; devices: Device[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<{ max: number; devices: Device[] }>("/api/account/devices"));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signOut = async (d: Device) => {
    setBusy(d.id);
    try {
      await api(`/api/account/devices/${d.id}`, { method: "DELETE" });
      toast(`Signed out ${d.label}.`);
    } catch (e) {
      toast(errorMessage(e), "warning");
    } finally {
      setBusy(null);
      void load();
    }
  };

  const signOutOthers = async () => {
    setBusy("others");
    try {
      const r = await api<{ count: number }>("/api/account/devices", { method: "DELETE" });
      toast(r.count ? `Signed out ${r.count} other device${r.count === 1 ? "" : "s"}.` : "No other devices were signed in.");
    } catch (e) {
      toast(errorMessage(e), "warning");
    } finally {
      setBusy(null);
      void load();
    }
  };

  const devices = data?.devices ?? [];
  const max = data?.max ?? 3;
  return (
    <Card as="section" aria-labelledby="devices-title" id="devices" className="scroll-mt-24">
      <div className="flex flex-wrap items-center gap-3">
        <Icon3D name="security" size={36} />
        <h2 id="devices-title" className="mr-auto text-lg font-bold text-ink">
          Signed-in devices
        </h2>
        {data && (
          <span className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-bold ${devices.length >= max ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary"}`}>
            {Math.min(devices.length, max)} of {max} in use
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        Your account can be signed in on up to {max} devices. When all {max} are in use, signing in on a new one signs out the device you used longest ago.
      </p>

      {error ? (
        <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : !data ? (
        <div className="mt-4 space-y-3" aria-label="Loading devices">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {devices.map((d) => {
            const icon = KIND_ICON[d.kind];
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-4 py-4">
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft" aria-hidden>
                  <Image src={icon.src} alt="" width={icon.width} height={icon.height} className="h-6 w-auto max-w-8 object-contain" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
                    {d.label}
                    {d.current && <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-bold text-success">This device</span>}
                  </p>
                  <p className="text-sm text-muted">
                    {d.current ? "Active now" : `Active ${formatRelative(d.lastActiveAt)}`} · Signed in {formatDate(d.signedInAt)}
                  </p>
                </div>
                {!d.current && (
                  <Button variant="secondary" size="sm" loading={busy === d.id} disabled={busy !== null && busy !== d.id} onClick={() => void signOut(d)}>
                    Sign out
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {devices.length > 1 && (
        <div className="mt-2 flex justify-end">
          <Button variant="ghost" size="sm" loading={busy === "others"} disabled={busy !== null && busy !== "others"} onClick={() => void signOutOthers()}>
            Sign out all other devices
          </Button>
        </div>
      )}
    </Card>
  );
}
