import Image from "next/image";
import { Logo } from "@/components/brand/Logo";
import { BRAND } from "@/lib/config/assets";
import { NavLinks } from "./NavLinks";

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface px-3 py-5 lg:flex">
      <div className="mb-8 px-3">
        <Logo href="/dashboard" size={46} priority />
      </div>
      <NavLinks />
      <div className="mt-auto px-1 pt-8">
        <div className="overflow-hidden rounded-2xl border border-line bg-[#f4f8ff]">
          <Image src={BRAND.motto.src} alt="Practice, learn, improve, succeed!" width={BRAND.motto.width} height={BRAND.motto.height} className="mx-auto h-auto w-full max-w-[216px]" />
        </div>
      </div>
    </aside>
  );
}
