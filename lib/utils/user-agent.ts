/** What kind of device a browser runs on, for the right icon in the device list. */
export type DeviceKind = "vr" | "phone" | "computer" | "unknown";

export interface DeviceInfo {
  /** "Meta Quest browser", "Chrome on Mac", "Safari on iPhone". */
  label: string;
  kind: DeviceKind;
}

/** A plain name for a browser from its user agent. Only a rough guide: user agents can be changed. */
export function describeDevice(userAgent: string | null | undefined): DeviceInfo {
  const ua = userAgent ?? "";
  if (/OculusBrowser|Quest/i.test(ua)) return { label: "Meta Quest browser", kind: "vr" };

  const os = /iPhone/.test(ua)
    ? { name: "iPhone", kind: "phone" as const }
    : /iPad/.test(ua)
      ? { name: "iPad", kind: "phone" as const }
      : /Android/.test(ua)
        ? { name: "Android", kind: "phone" as const }
        : /CrOS/.test(ua)
          ? { name: "Chromebook", kind: "computer" as const }
          : /Macintosh|Mac OS X/.test(ua)
            ? { name: "Mac", kind: "computer" as const }
            : /Windows/.test(ua)
              ? { name: "Windows", kind: "computer" as const }
              : /Linux/.test(ua)
                ? { name: "Linux", kind: "computer" as const }
                : null;

  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox|FxiOS/.test(ua)
          ? "Firefox"
          : /Chrome|CriOS|Chromium/.test(ua)
            ? "Chrome"
            : /Safari/.test(ua)
              ? "Safari"
              : null;

  if (!os) return { label: browser ? `${browser} browser` : "Unknown device", kind: "unknown" };
  return { label: browser ? `${browser} on ${os.name}` : os.name, kind: os.kind };
}
