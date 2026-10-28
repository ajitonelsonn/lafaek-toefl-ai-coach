"use client";

import { Copy, Printer } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Icon3D } from "@/components/ui/Icon3D";
import { useToast } from "@/components/ui/Toast";

/** Print / save as PDF, copy the verification link, and add the certificate to a LinkedIn profile. */
export function CertificateActions({ code, verifyUrl, issuedAt }: { code: string; verifyUrl: string; issuedAt: string }) {
  const toast = useToast();
  const issued = new Date(issuedAt);
  const linkedIn = `https://www.linkedin.com/profile/add?${new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: "LafaekTOEFL Mock Test Certificate of Achievement",
    organizationName: "LafaekTOEFL AI Coach",
    issueYear: String(issued.getUTCFullYear()),
    issueMonth: String(issued.getUTCMonth() + 1),
    certUrl: verifyUrl,
    certId: code,
  })}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      toast("Verification link copied.", "success");
    } catch {
      toast("Could not copy. Select the link and copy it instead.", "warning");
    }
  };

  return (
    <div className="flex flex-wrap justify-center gap-3 print:hidden">
      <Button leftIcon={<Printer className="size-4" />} onClick={() => window.print()}>
        Print or save as PDF
      </Button>
      <Button variant="secondary" leftIcon={<Copy className="size-4" />} onClick={() => void copy()}>
        Copy verification link
      </Button>
      <a href={linkedIn} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "secondary" })}>
        <Icon3D name="share" size={20} /> Add to LinkedIn
      </a>
    </div>
  );
}
