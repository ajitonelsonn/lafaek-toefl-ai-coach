// SAMPLE CONTENT — hand-written demo items. Names are fictional.
import type { BuildSentenceSet, InterviewSet, ListenRepeatSet, MediaRef, WritingSet } from "../../../lib/services/types";

function audio(id: string, transcript: string): MediaRef {
  const words = transcript.split(/\s+/).length;
  return { id, kind: "audio", url: null, transcript, estimatedSeconds: Math.max(2, Math.round(words / 2.4)) };
}

export const buildSentence: BuildSentenceSet = {
  kind: "build-sentence",
  items: [
    {
      id: "bs-1",
      context: "The annual technology conference was an enormous success.",
      tokens: ["do", "you", "know", "if", "they announced", "the dates"],
      suffix: "for next year's event?",
      answer: "Do you know if they announced the dates for next year's event?",
      parts: [
        { role: "opener", text: "Do you know" },
        { role: "connector", text: "if" },
        { role: "subject", text: "they" },
        { role: "verb", text: "announced" },
        { role: "object", text: "the dates" },
        { role: "rest", text: "for next year's event" },
      ],
      explanation:
        "After “Do you know if…”, use statement order: subject + verb (they announced) + object (the dates). Don't use question order (did they announce) inside an indirect question.",
    },
    {
      id: "bs-6",
      context: "The art exhibit at the gallery is stunning.",
      tokens: ["do", "you", "know", "if", "it", "will still", "be open"],
      suffix: "next month?",
      answer: "Do you know if it will still be open next month?",
      parts: [
        { role: "opener", text: "Do you know" },
        { role: "connector", text: "if" },
        { role: "subject", text: "it" },
        { role: "verb", text: "will still be open" },
        { role: "rest", text: "next month" },
      ],
      explanation: "After “Do you know if…”, use statement order: subject (it) + verb (will still be open). “Still” goes between “will” and “be”.",
    },
    {
      id: "bs-7",
      context: "The seminar on climate change was eye-opening.",
      tokens: ["can", "you", "tell me", "whether", "it", "is"],
      suffix: "available online?",
      answer: "Can you tell me whether it is available online?",
      parts: [
        { role: "opener", text: "Can you tell me" },
        { role: "connector", text: "whether" },
        { role: "subject", text: "it" },
        { role: "verb", text: "is" },
        { role: "rest", text: "available online" },
      ],
      explanation: "In an indirect question, “whether” is followed by statement order: “it is”, not “is it”.",
    },
    {
      id: "bs-2",
      context: "I've been looking for a quiet place to study all week.",
      tokens: ["have", "you", "tried", "the reading room", "on", "the third floor"],
      suffix: "?",
      answer: "Have you tried the reading room on the third floor?",
      parts: [
        { role: "opener", text: "Have" },
        { role: "subject", text: "you" },
        { role: "verb", text: "tried" },
        { role: "object", text: "the reading room" },
        { role: "rest", text: "on the third floor" },
      ],
      explanation: "A present perfect question starts with “have” + subject + past participle (tried). The place phrase comes at the end.",
    },
    {
      id: "bs-3",
      context: "Our group presentation is next Monday.",
      tokens: ["could", "you", "tell me", "when", "we", "should meet"],
      suffix: "to practise?",
      answer: "Could you tell me when we should meet to practise?",
      parts: [
        { role: "opener", text: "Could you tell me" },
        { role: "connector", text: "when" },
        { role: "subject", text: "we" },
        { role: "verb", text: "should meet" },
        { role: "rest", text: "to practise" },
      ],
      explanation: "In an indirect question, the words after “when” use statement order: “we should meet”, not “should we meet”.",
    },
    {
      id: "bs-4",
      context: "The cafeteria was closed all morning.",
      tokens: ["I", "wonder", "why", "it", "was", "closed"],
      suffix: "today.",
      answer: "I wonder why it was closed today.",
      parts: [
        { role: "subject", text: "I" },
        { role: "verb", text: "wonder" },
        { role: "connector", text: "why" },
        { role: "subject", text: "it" },
        { role: "verb", text: "was closed" },
        { role: "rest", text: "today" },
      ],
      explanation: "“I wonder why…” is a statement, so it ends with a period. After “why”, keep statement order: it + was closed.",
    },
    {
      id: "bs-5",
      context: "The new software update is finally available.",
      tokens: ["do", "you", "know", "how long", "the download", "takes"],
      suffix: "?",
      answer: "Do you know how long the download takes?",
      parts: [
        { role: "opener", text: "Do you know" },
        { role: "connector", text: "how long" },
        { role: "subject", text: "the download" },
        { role: "verb", text: "takes" },
      ],
      explanation: "After “Do you know how long…”, use subject + verb: “the download takes” (not “does the download take”).",
    },
  ],
};

export const writeEmail: WritingSet = {
  kind: "write-email",
  items: [
    {
      id: "we-1",
      illustration: "emailHiking",
      scenario:
        "You want to plan an overnight hiking trip with your friends next month. You need to decide on the location, make sure everyone has their own tent, food, and backpack, and organize transportation there and back. You need to ask your friend, Chris, for help organizing the trip.",
      bullets: [
        "Suggest a location for the hiking trip and explain why it is a good choice.",
        "Describe what everyone will need to bring.",
        "Ask for help in organizing transportation.",
      ],
      recipient: "Chris",
      subject: "Help with planning a hiking trip",
      minWords: 80,
      checklist: [
        "Suggest a location and explain why it is a good choice.",
        "Describe what everyone will need to bring.",
        "Ask for help in organizing transportation.",
      ],
      tips: ["a clear purpose", "relevant details", "polite and natural language", "complete sentences"],
    },
    {
      id: "we-2",
      scenario:
        "You are taking a history course. You were sick last week and missed the deadline for a short essay. You want to write to your instructor, Professor Lee, to explain what happened.",
      bullets: [
        "Explain why you missed the deadline.",
        "Ask for a new deadline and suggest a date.",
        "Ask whether you missed any important class information.",
      ],
      recipient: "Professor Lee",
      subject: "Missed essay deadline",
      minWords: 80,
      checklist: [
        "Explain why you missed the deadline.",
        "Ask for a new deadline and suggest a date.",
        "Ask about missed class information.",
      ],
      tips: ["a polite greeting and closing", "a clear request", "a reason with details", "a respectful tone"],
    },
  ],
};

export const academicDiscussion: WritingSet = {
  kind: "academic-discussion",
  items: [
    {
      id: "ad-1",
      scenario: "Your professor is teaching a class on public health. Write a post responding to the professor's question.",
      bullets: ["Express and support your opinion.", "Make a contribution to the discussion in your own words."],
      professor: {
        name: "Dr. Achebe",
        prompt:
          "Let's continue our discussion of leisure time. Some health professionals worry that people's free time is now spent mostly indoors and that this affects their physical and mental health. Others do not think it matters whether free time is spent indoors or outdoors. What do you think? Is spending time outdoors in nature important for people's well-being? Why or why not?",
      },
      students: [
        {
          name: "Andrew",
          text: "I do think spending time outdoors is important. Being in nature helps people feel more connected to the natural world. It may also make them care more about protecting nature and taking action on problems such as pollution.",
        },
        {
          name: "Claire",
          text: "I have to disagree with Andrew. A good documentary can also help people appreciate nature. Not everyone enjoys being outside — I don't like insects or changing weather. So I don't think everyone needs to spend time outdoors to be well.",
        },
      ],
      minWords: 100,
      maxWords: 300,
      checklist: ["Express and support your opinion.", "Make a contribution to the discussion in your own words."],
      tips: [
        "Clearly state your opinion.",
        "Give specific reasons and examples.",
        "Respond to the ideas from other students.",
        "Write at least 100 words.",
      ],
    },
    {
      id: "ad-2",
      scenario: "Your professor is teaching a class on education. Write a post responding to the professor's question.",
      bullets: ["Express and support your opinion.", "Make a contribution to the discussion in your own words."],
      professor: {
        name: "Dr. Lin",
        prompt:
          "Many universities now ask all first-year students to take a public speaking course, whatever their major. Supporters say it builds confidence and helps in any career. Critics say students should use that time for courses in their own field. Should a public speaking course be required? Why or why not?",
      },
      students: [
        {
          name: "Priya",
          text: "I think it should be required. In almost every job you need to present ideas clearly. Many students are shy, and a course gives them a safe place to practise.",
        },
        {
          name: "Tomás",
          text: "I'm not sure. Students already have many required classes. Speaking skills can be practised in other courses through presentations, so a separate course may not be necessary.",
        },
      ],
      minWords: 100,
      maxWords: 300,
      checklist: ["Express and support your opinion.", "Make a contribution to the discussion in your own words."],
      tips: [
        "Clearly state your opinion.",
        "Add a new idea instead of repeating Priya or Tomás.",
        "Use an example from your own experience.",
        "Write at least 100 words.",
      ],
    },
  ],
};

export const listenRepeat: ListenRepeatSet = {
  kind: "listen-repeat",
  situation:
    "You are working in an office. Your manager is teaching you how to help new employees use the office printer and scanner.",
  items: [
    { id: "lr-1", audio: audio("lr-1-audio", "The printer is next to the kitchen."), responseSeconds: 8 },
    { id: "lr-2", audio: audio("lr-2-audio", "Press the green button to start copying."), responseSeconds: 8 },
    { id: "lr-3", audio: audio("lr-3-audio", "Scanned files are sent straight to your email."), responseSeconds: 10 },
    { id: "lr-4", audio: audio("lr-4-audio", "Please use recycled paper when you print drafts."), responseSeconds: 10 },
    { id: "lr-5", audio: audio("lr-5-audio", "If the paper gets stuck, open the panel on the left side."), responseSeconds: 12 },
    { id: "lr-6", audio: audio("lr-6-audio", "You can ask the front desk for a new ink cartridge."), responseSeconds: 12 },
    { id: "lr-7", audio: audio("lr-7-audio", "Remember to collect your pages right after printing."), responseSeconds: 10 },
  ],
};

export const takeInterview: InterviewSet = {
  kind: "take-interview",
  scenario:
    "You have volunteered for a research study about people's experiences with gardening. You will have a short online interview with a researcher. The researcher will ask you some questions.",
  items: [
    {
      id: "ti-1",
      audio: audio("ti-1-audio", "Thank you for joining us. To begin, do you have any experience with gardening? Please tell me about it."),
      responseSeconds: 45,
    },
    {
      id: "ti-2",
      audio: audio("ti-2-audio", "What do you think people enjoy most about gardening? Why?"),
      responseSeconds: 45,
    },
    {
      id: "ti-3",
      audio: audio("ti-3-audio", "Some people say gardening is a good activity for children. Do you agree? Why or why not?"),
      responseSeconds: 45,
    },
    {
      id: "ti-4",
      audio: audio(
        "ti-4-audio",
        "Many cities now have community gardens, where neighbours share one space. What are the advantages and disadvantages of shared gardens?",
      ),
      responseSeconds: 45,
    },
  ],
};
