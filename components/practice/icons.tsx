import {
  BookOpen,
  FileText,
  GraduationCap,
  Headphones,
  Mail,
  Megaphone,
  MessageSquareText,
  MessagesSquare,
  Mic,
  MicVocal,
  PencilLine,
  Puzzle,
  TextCursorInput,
  type LucideIcon,
} from "lucide-react";
import type { PracticeSlug, SkillId } from "@/lib/config/practice-types";
import type { Icon3DName } from "@/lib/config/assets";
import { cn } from "@/lib/utils/cn";

export const SKILL_ICON: Record<SkillId, LucideIcon> = {
  reading: BookOpen,
  listening: Headphones,
  writing: PencilLine,
  speaking: Mic,
};

export const SKILL_ICON_3D: Record<SkillId, Icon3DName> = {
  reading: "reading",
  listening: "listening",
  writing: "writing",
  speaking: "speaking",
};

export const PRACTICE_ICON: Record<PracticeSlug, LucideIcon> = {
  "complete-the-words": TextCursorInput,
  "read-in-daily-life": FileText,
  "read-academic-passage": BookOpen,
  "listen-choose-response": Headphones,
  "listen-conversation": MessagesSquare,
  "listen-announcement": Megaphone,
  "listen-academic-talk": GraduationCap,
  "build-sentence": Puzzle,
  "write-email": Mail,
  "academic-discussion": MessageSquareText,
  "listen-repeat": Mic,
  "take-interview": MicVocal,
};

export const SKILL_TONE: Record<SkillId, { text: string; soft: string; border: string; tone: SkillId }> = {
  reading: { text: "text-reading", soft: "bg-reading-soft", border: "border-reading/25", tone: "reading" },
  listening: { text: "text-listening", soft: "bg-listening-soft", border: "border-listening/25", tone: "listening" },
  writing: { text: "text-writing", soft: "bg-writing-soft", border: "border-writing/25", tone: "writing" },
  speaking: { text: "text-speaking", soft: "bg-speaking-soft", border: "border-speaking/25", tone: "speaking" },
};

export function SkillIconTile({ skill, slug, size = "md", className }: { skill: SkillId; slug?: PracticeSlug; size?: "sm" | "md" | "lg"; className?: string }) {
  const Icon = slug ? PRACTICE_ICON[slug] : SKILL_ICON[skill];
  const t = SKILL_TONE[skill];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl",
        t.soft,
        t.text,
        size === "sm" && "size-9 [&>svg]:size-[18px]",
        size === "md" && "size-11 [&>svg]:size-5",
        size === "lg" && "size-14 rounded-2xl [&>svg]:size-7",
        className,
      )}
    >
      <Icon />
    </span>
  );
}
