"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { BookOpen, Bookmark, BookmarkCheck, Check, ChevronLeft, ChevronRight, List, RotateCcw, Search, Share2, Star, Volume2, Zap } from "lucide-react";
import { VOCAB_CATEGORIES } from "@/lib/content/vocabulary";
import { getPracticeType } from "@/lib/config/practice-types";
import { gsap, useMotion } from "@/lib/client/motion";
import type { VocabCategory, VocabWord } from "@/lib/services/types";
import { api, errorMessage } from "@/lib/client/api";
import { useSession } from "@/components/session/SessionProvider";

export interface VocabProgress {
  status?: "known" | "review";
  bookmarked?: boolean;
}
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChipGroup, Tabs } from "@/components/ui/Segmented";
import { ProgressBar, ProgressRing } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/States";
import { TipCard } from "@/components/ui/Callouts";
import { Icon3D } from "@/components/ui/Icon3D";
import { useToast } from "@/components/ui/Toast";
import { VocabularyQuiz } from "./VocabularyQuiz";

type Tab = "practice" | "list" | "review" | "mine";

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
  return true;
}


function Highlight({ text, word }: { text: string; word: string }) {
  const i = text.toLowerCase().indexOf(word.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-semibold text-primary">{text.slice(i, i + word.length)}</mark>
      {text.slice(i + word.length)}
    </>
  );
}

export function VocabularyPage({ words, initialProgress, pending, hasPlan }: { words: VocabWord[]; initialProgress: Record<string, VocabProgress>; pending: boolean; hasPlan: boolean }) {
  const { settings } = useSession();
  const toast = useToast();
  const [vocab, setVocabState] = useState(initialProgress);

  /** Optimistic update, saved to the server; rolled back if saving fails. */
  const setVocab = useCallback(
    async (id: string, patch: VocabProgress) => {
      const before = vocab[id];
      setVocabState((v) => ({ ...v, [id]: { ...v[id], ...patch } }));
      try {
        await api(`/api/vocabulary/${id}`, { method: "PUT", body: patch });
      } catch (e) {
        setVocabState((v) => ({ ...v, [id]: before ?? {} }));
        toast(errorMessage(e), "warning");
      }
    },
    [toast, vocab],
  );
  const [tab, setTab] = useState<Tab>("practice");
  const [category, setCategory] = useState<"all" | VocabCategory>("all");
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  // Direction of the last move, so the next card slides in from the matching side.
  const [direction, setDirection] = useState<1 | -1>(1);
  const [quizOpen, setQuizOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words.filter((w) => {
      if (category !== "all" && w.category !== category) return false;
      if (tab === "review" && vocab[w.id]?.status !== "review") return false;
      if (tab === "mine" && !vocab[w.id]?.bookmarked) return false;
      const searchable = tab === "list" || tab === "mine";
      if (searchable && q && !w.word.toLowerCase().includes(q) && !w.meaning.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [category, query, tab, vocab, words]);

  const known = words.filter((w) => vocab[w.id]?.status === "known").length;
  const reviewCount = words.filter((w) => vocab[w.id]?.status === "review").length;
  const bookmarked = words.filter((w) => vocab[w.id]?.bookmarked).length;
  const safeIndex = Math.min(index, Math.max(0, filtered.length - 1));
  const current = filtered[safeIndex];

  // Natural voice (ElevenLabs, made once per word on the server). Signed URLs are cached until
  // shortly before they expire; the browser voice is only a fallback.
  const audioUrls = useRef(new Map<string, { url: string; until: number }>());
  const player = useRef<HTMLAudioElement | null>(null);
  const [loadingWord, setLoadingWord] = useState<string | null>(null);
  const pronounce = async (w: VocabWord) => {
    if (!settings.sound) return toast("Sound is turned off in Settings.", "warning");
    if (loadingWord) return;
    try {
      let cached = audioUrls.current.get(w.id);
      if (!cached || cached.until < Date.now()) {
        setLoadingWord(w.id);
        const r = await api<{ url: string; expiresIn: number }>(`/api/vocabulary/${w.id}/audio`, { method: "POST", body: {} });
        cached = { url: r.url, until: Date.now() + (r.expiresIn - 30) * 1000 };
        audioUrls.current.set(w.id, cached);
      }
      player.current?.pause();
      player.current = new Audio(cached.url);
      await player.current.play();
    } catch {
      if (!speak(w.word)) toast("Audio is not available right now.", "warning");
    } finally {
      setLoadingWord(null);
    }
  };

  const changeTab = (t: Tab) => {
    setTab(t);
    setIndex(0);
  };
  const categories = VOCAB_CATEGORIES.filter((c) => words.some((w) => w.category === c.id));

  if (words.length === 0) {
    return (
      <EmptyState
        icon={<Icon3D name="search" size={40} />}
        title={pending ? "Your vocabulary is being prepared" : "No vocabulary yet"}
        description={
          pending
            ? "Words are taken from your personalised practice questions. They appear here after each practice type is generated. You can leave this page."
            : hasPlan
              ? "Words are taken from your personalised practice questions. They will appear when your questions are ready."
              : "Make a study plan first. Your vocabulary list is created from the personalised questions it generates."
        }
        action={!hasPlan && <LinkButton href="/study-plan" size="sm">Make a study plan</LinkButton>}
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Tabs
          label="Vocabulary views"
          idPrefix="vocab"
          value={tab}
          onChange={changeTab}
          options={[
            { value: "practice", label: "Practice", icon: <BookOpen /> },
            { value: "list", label: "Word List", icon: <List /> },
            { value: "review", label: `Review (${reviewCount})`, icon: <RotateCcw /> },
            { value: "mine", label: `My Words (${bookmarked})`, icon: <Star /> },
          ]}
        />

        <div id="vocab-panel" role="tabpanel" aria-labelledby={`vocab-tab-${tab}`} className="flex flex-col gap-5">
          <Card padded={false} className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-ink">Category:</span>
              <ChipGroup
                label="Filter by category"
                value={category}
                onChange={(c) => {
                  setCategory(c);
                  setIndex(0);
                }}
                options={[{ value: "all", label: "All" }, ...categories.map((c) => ({ value: c.id, label: c.label }))]}
              />
            </div>
            {(tab === "list" || tab === "mine") && (
              <div className="relative max-w-sm">
                <label htmlFor="vocab-search" className="sr-only">
                  Search words
                </label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  id="vocab-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search words or meanings…"
                  className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20"
                />
              </div>
            )}
          </Card>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Icon3D name={tab === "mine" ? "favorite" : tab === "review" ? "retry" : "search"} size={40} />}
              title={tab === "mine" ? "No saved words yet" : tab === "review" ? "Nothing to review" : "No words found"}
              description={
                tab === "mine"
                  ? "Use the bookmark button on a word to save it here."
                  : tab === "review"
                    ? "Words you mark “Review again” will appear here."
                    : "Try another category or search word."
              }
              action={
                <Button size="sm" variant="secondary" onClick={() => { setCategory("all"); setQuery(""); changeTab("practice"); }}>
                  Back to practice
                </Button>
              }
            />
          ) : tab === "practice" || tab === "review" ? (
            <Flashcard
              word={current}
              position={`${safeIndex + 1} / ${filtered.length}`}
              progress={vocab[current.id]}
              direction={direction}
              onPrev={() => {
                setDirection(-1);
                setIndex((i) => (i - 1 + filtered.length) % filtered.length);
              }}
              onNext={() => {
                setDirection(1);
                setIndex((i) => (i + 1) % filtered.length);
              }}
              onPronounce={() => pronounce(current)}
              onKnow={() => {
                setDirection(1);
                setVocab(current.id, { status: "known" });
                if (tab !== "review") setIndex((i) => (i + 1) % filtered.length);
              }}
              onReview={() => {
                setDirection(1);
                setVocab(current.id, { status: "review" });
                setIndex((i) => (i + 1) % filtered.length);
              }}
              onBookmark={() => {
                const on = !vocab[current.id]?.bookmarked;
                setVocab(current.id, { bookmarked: on });
                toast(on ? `“${current.word}” added to My Words.` : `“${current.word}” removed from My Words.`, on ? "success" : "info");
              }}
            />
          ) : (
            <WordList words={filtered} vocab={vocab} onPronounce={pronounce} setVocab={setVocab} />
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-5" aria-label="Vocabulary progress and actions">
        <Card as="section" aria-labelledby="vp-title">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="vp-title" className="text-base font-bold text-ink">
              Vocabulary Progress
            </h2>
            <StatusBadge tone="primary">From your questions</StatusBadge>
          </div>
          <div className="flex items-center gap-4">
            <ProgressRing value={known} max={words.length} size={96} label={`${known} of ${words.length} words known`}>
              <span className="text-lg font-bold text-ink">{Math.round((known / words.length) * 100)}%</span>
            </ProgressRing>
            <div className="flex-1">
              <p className="text-sm text-muted">Words learned</p>
              <p className="text-2xl font-bold text-ink tabular-nums">
                {known} / {words.length}
              </p>
              <ProgressBar value={known} max={words.length} label="Words learned" size="sm" className="mt-2" />
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-warning-soft p-2">
              <dt className="text-muted">To review</dt>
              <dd className="font-bold text-ink">{reviewCount}</dd>
            </div>
            <div className="rounded-lg bg-primary-soft p-2">
              <dt className="text-muted">Saved</dt>
              <dd className="font-bold text-ink">{bookmarked}</dd>
            </div>
          </dl>
          {pending && <p className="mt-3 text-xs text-muted">More words are added as your practice questions are generated.</p>}
        </Card>
        <TipCard>
          <ul className="list-disc space-y-1 pl-4">
            <li>Learn words in context with example sentences.</li>
            <li>Practise a little every day.</li>
            <li>Use new words in your own sentences.</li>
          </ul>
        </TipCard>
        <Card as="section" aria-labelledby="qa-title">
          <h2 id="qa-title" className="mb-3 flex items-center gap-2 text-base font-bold text-ink">
            <Zap className="size-5 text-primary" aria-hidden /> Quick Actions
          </h2>
          <div className="flex flex-col gap-2">
            <Button fullWidth onClick={() => setQuizOpen(true)}>
              Start Vocabulary Quiz
            </Button>
            <Button fullWidth variant="secondary" leftIcon={<List className="size-4" />} onClick={() => changeTab("list")}>
              View Word List
            </Button>
            <Button fullWidth variant="secondary" leftIcon={<Star className="size-4" />} onClick={() => changeTab("mine")}>
              Open My Words
            </Button>
          </div>
        </Card>
      </aside>

      <VocabularyQuiz open={quizOpen} onClose={() => setQuizOpen(false)} words={category === "all" ? words : words.filter((w) => w.category === category)} />
    </div>
  );
}

function Flashcard(props: {
  word: VocabWord;
  position: string;
  progress?: VocabProgress;
  direction: 1 | -1;
  onPrev: () => void;
  onNext: () => void;
  onPronounce: () => void;
  onKnow: () => void;
  onReview: () => void;
  onBookmark: () => void;
}) {
  const { word, progress } = props;
  const source = word.taskSlug ? getPracticeType(word.taskSlug)?.title : undefined;
  const face = useRef<HTMLDivElement>(null);
  const firstWord = useRef(word.id);
  useMotion(face, (el) => {
    if (firstWord.current === word.id) return; // no slide on first show
    firstWord.current = word.id;
    gsap.fromTo(el, { x: 36 * props.direction, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.35, ease: "power2.out", clearProps: "transform,opacity,visibility" });
  }, [word.id]);
  return (
    <Card as="section" aria-label={`Flashcard: ${word.word}`} aria-live="polite">
      <div className="flex items-center gap-3">
        <button type="button" onClick={props.onPrev} className="hidden size-11 shrink-0 items-center justify-center rounded-full border border-line text-primary hover:border-primary sm:inline-flex" aria-label="Previous word">
          <ChevronLeft className="size-5" />
        </button>
        <div ref={face} className="grid min-w-0 flex-1 gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-muted">{props.position}</span>
              <div className="flex items-center gap-2">
                {progress?.status === "known" && <StatusBadge tone="success">Known</StatusBadge>}
                {progress?.status === "review" && <StatusBadge tone="warning">Review again</StatusBadge>}
                <StatusBadge tone="primary" className="capitalize">
                  {word.partOfSpeech}
                </StatusBadge>
              </div>
            </div>
            <h2 className="mt-2 break-words text-4xl font-extrabold text-ink">{word.word}</h2>
            <button type="button" onClick={props.onPronounce} className="mt-2 inline-flex items-center gap-2 rounded-lg px-1 text-primary hover:bg-primary-soft" aria-label={`Listen to “${word.word}”`}>
              <Volume2 className="size-5" aria-hidden />
              <span className="font-mono text-base text-body">{word.pronunciation}</span>
            </button>
            <p className="mt-4 text-lg text-body">{word.meaning}</p>
            <div className="mt-4 rounded-xl bg-primary-soft/70 p-4">
              <p className="text-sm font-bold text-ink">Example:</p>
              <p className="mt-1 text-[15px] text-body">
                <Highlight text={word.example} word={word.word} />
              </p>
            </div>
            {source && <p className="mt-2 text-xs text-muted">From your “{source}” questions</p>}
          </div>
        </div>
        <button type="button" onClick={props.onNext} className="hidden size-11 shrink-0 items-center justify-center rounded-full border border-line text-primary hover:border-primary sm:inline-flex" aria-label="Next word">
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button variant="soft" leftIcon={<Check className="size-4" />} onClick={props.onKnow} aria-pressed={progress?.status === "known"}>
          Know it
        </Button>
        <Button variant="secondary" leftIcon={<RotateCcw className="size-4" />} onClick={props.onReview} aria-pressed={progress?.status === "review"}>
          Review again
        </Button>
        <Button
          variant="secondary"
          leftIcon={progress?.bookmarked ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
          onClick={props.onBookmark}
          aria-pressed={!!progress?.bookmarked}
        >
          {progress?.bookmarked ? "Saved" : "Save word"}
        </Button>
        <div className="ml-auto flex gap-2 sm:hidden">
          <Button variant="secondary" size="sm" onClick={props.onPrev} aria-label="Previous word">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={props.onNext} aria-label="Next word">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {word.related && (
        <div className="mt-5">
          <p className="mb-2 flex items-center gap-2 font-bold text-ink">
            <Share2 className="size-4 text-primary" aria-hidden /> Related Words
          </p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {word.related.map((r) => (
              <li key={r.word} className="rounded-xl border border-line p-3">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{r.word}</span>
                  <StatusBadge tone="listening" className="capitalize">
                    {r.partOfSpeech}
                  </StatusBadge>
                </p>
                <p className="mt-1 text-sm text-body">{r.meaning}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function WordList({ words, vocab, onPronounce, setVocab }: { words: VocabWord[]; vocab: Record<string, VocabProgress>; onPronounce: (w: VocabWord) => void; setVocab: (id: string, patch: VocabProgress) => void }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {words.map((w) => {
        const p = vocab[w.id];
        return (
          <li key={w.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold text-ink">{w.word}</span>
              <StatusBadge tone="primary" className="capitalize">
                {w.partOfSpeech}
              </StatusBadge>
              <button type="button" onClick={() => onPronounce(w)} className="rounded-full p-1 text-primary hover:bg-primary-soft" aria-label={`Listen to “${w.word}”`}>
                <Volume2 className="size-4" />
              </button>
              <span className="ml-auto flex gap-1.5">
                {p?.status === "known" && <StatusBadge tone="success">Known</StatusBadge>}
                {p?.status === "review" && <StatusBadge tone="warning">Review</StatusBadge>}
                {!p?.status && <StatusBadge>New</StatusBadge>}
              </span>
            </div>
            <p className="text-sm text-body">{w.meaning}</p>
            <p className="text-sm italic text-muted">“{w.example}”</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="soft" onClick={() => setVocab(w.id, { status: "known" })} aria-pressed={p?.status === "known"}>
                Know it
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setVocab(w.id, { status: "review" })} aria-pressed={p?.status === "review"}>
                Review again
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setVocab(w.id, { bookmarked: !p?.bookmarked })}
                aria-pressed={!!p?.bookmarked}
                aria-label={p?.bookmarked ? `Remove ${w.word} from My Words` : `Save ${w.word} to My Words`}
              >
                {p?.bookmarked ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
