// SAMPLE CONTENT — hand-written demo items. No audio files exist yet (url: null);
// the UI reads each transcript with the browser's speech voice and labels it as demo audio.
import type { ChooseResponseSet, ListeningSet, MediaRef } from "@/lib/services/types";

function audio(id: string, transcript: string, turns?: MediaRef["turns"]): MediaRef {
  const words = (turns ? turns.map((t) => t.text).join(" ") : transcript).split(/\s+/).length;
  return { id, kind: "audio", url: null, transcript, turns, estimatedSeconds: Math.max(3, Math.round(words / 2.4)) };
}

function fromTurns(id: string, turns: { speaker: string; text: string }[]): MediaRef {
  return audio(id, turns.map((t) => `${t.speaker}: ${t.text}`).join("\n"), turns);
}

export const listenChooseResponse: ChooseResponseSet = {
  kind: "listen-choose-response",
  items: [
    {
      id: "lcr-1",
      audio: audio("lcr-1-audio", "I forgot my umbrella, and it's starting to rain."),
      question: {
        id: "lcr-1-q",
        prompt: "Choose the best response.",
        options: [
          { id: "A", text: "I made coffee yesterday." },
          { id: "B", text: "The weather was nice last week." },
          { id: "C", text: "I forgot it at home, too." },
          { id: "D", text: "You can borrow one of mine." },
        ],
        answerId: "D",
        explanation: "The speaker has a problem (no umbrella in the rain). Offering to lend one is the most natural, helpful reply.",
      },
    },
    {
      id: "lcr-2",
      audio: audio("lcr-2-audio", "Has the professor posted our grades yet?"),
      question: {
        id: "lcr-2-q",
        prompt: "Choose the best response.",
        options: [
          { id: "A", text: "Yes, they went up this morning." },
          { id: "B", text: "She teaches biology." },
          { id: "C", text: "I graded it myself." },
          { id: "D", text: "The post office is closed." },
        ],
        answerId: "A",
        explanation: "A yes/no question about grades is best answered directly: the grades “went up” (were posted) this morning.",
      },
    },
    {
      id: "lcr-3",
      audio: audio("lcr-3-audio", "Would you like to join our study group on Thursday?"),
      question: {
        id: "lcr-3-q",
        prompt: "Choose the best response.",
        options: [
          { id: "A", text: "I studied last Thursday." },
          { id: "B", text: "I'd love to. What time?" },
          { id: "C", text: "The group is very large." },
          { id: "D", text: "Thursday comes after Wednesday." },
        ],
        answerId: "B",
        explanation: "This is an invitation. Accepting and asking for the time continues the conversation naturally.",
      },
    },
    {
      id: "lcr-4",
      audio: audio("lcr-4-audio", "Excuse me, is anyone sitting here?"),
      question: {
        id: "lcr-4-q",
        prompt: "Choose the best response.",
        options: [
          { id: "A", text: "No, please go ahead." },
          { id: "B", text: "I sat there yesterday." },
          { id: "C", text: "The chairs are blue." },
          { id: "D", text: "Yes, I'm sitting at home." },
        ],
        answerId: "A",
        explanation: "The speaker wants to sit down. “No, please go ahead” means the seat is free.",
      },
    },
    {
      id: "lcr-5",
      audio: audio("lcr-5-audio", "Why don't we take the bus instead of walking?"),
      question: {
        id: "lcr-5-q",
        prompt: "Choose the best response.",
        options: [
          { id: "A", text: "Good idea — it's quite far." },
          { id: "B", text: "I walked my dog this morning." },
          { id: "C", text: "The bus is yellow." },
          { id: "D", text: "Because I don't." },
        ],
        answerId: "A",
        explanation: "“Why don't we…” is a suggestion, not a real question about reasons. Agreeing with a reason fits best.",
      },
    },
    {
      id: "lcr-6",
      audio: audio("lcr-6-audio", "I can't find my student ID card anywhere."),
      question: {
        id: "lcr-6-q",
        prompt: "Choose the best response.",
        options: [
          { id: "A", text: "Have you checked your backpack?" },
          { id: "B", text: "My ID number is very long." },
          { id: "C", text: "Cards are on sale downstairs." },
          { id: "D", text: "I found the test easy." },
        ],
        answerId: "A",
        explanation: "The speaker lost something. Suggesting where to look is a helpful, relevant reply.",
      },
    },
  ],
};

export const listenConversation: ListeningSet = {
  kind: "listen-conversation",
  items: [
    {
      id: "lc-1",
      title: "At the Library Help Desk",
      scene: "conversation",
      audio: fromTurns("lc-1-audio", [
        { speaker: "Student", text: "Hi, I'm looking for a quiet place to study. The first floor is really busy today." },
        { speaker: "Librarian", text: "Yes, there's a workshop down here this afternoon. The second floor has silent study rooms." },
        { speaker: "Student", text: "Great. Do I need to book a room?" },
        { speaker: "Librarian", text: "Not on weekdays, but they fill up fast. I'd suggest checking the room screen by the elevator before you go upstairs. It shows which rooms are free." },
        { speaker: "Student", text: "Perfect, thanks. And can I bring my coffee?" },
        { speaker: "Librarian", text: "Drinks with a lid are fine. Food isn't allowed in the silent rooms, though." },
      ]),
      questions: [
        {
          id: "lc-1-q1",
          prompt: "What is the main reason the student is visiting the help desk?",
          options: [
            { id: "A", text: "To return a book" },
            { id: "B", text: "To find a quiet place to study" },
            { id: "C", text: "To print a document" },
            { id: "D", text: "To join a workshop" },
          ],
          answerId: "B",
          explanation: "The student begins: “I'm looking for a quiet place to study.”",
        },
        {
          id: "lc-1-q2",
          prompt: "Which floor does the student plan to go to?",
          options: [
            { id: "A", text: "The first floor" },
            { id: "B", text: "The second floor" },
            { id: "C", text: "The third floor" },
            { id: "D", text: "The basement" },
          ],
          answerId: "B",
          explanation: "The librarian says the second floor has silent study rooms, and the student agrees.",
        },
        {
          id: "lc-1-q3",
          prompt: "What does the librarian suggest the student do before going upstairs?",
          options: [
            { id: "A", text: "Book a room online" },
            { id: "B", text: "Finish their coffee" },
            { id: "C", text: "Check the room screen by the elevator" },
            { id: "D", text: "Sign up for the workshop" },
          ],
          answerId: "C",
          explanation: "“I'd suggest checking the room screen by the elevator before you go upstairs.”",
        },
        {
          id: "lc-1-q4",
          prompt: "What is allowed in the silent study rooms?",
          options: [
            { id: "A", text: "Snacks" },
            { id: "B", text: "Drinks with a lid" },
            { id: "C", text: "Phone calls" },
            { id: "D", text: "Group discussions" },
          ],
          answerId: "B",
          explanation: "“Drinks with a lid are fine. Food isn't allowed.”",
        },
      ],
    },
    {
      id: "lc-2",
      title: "Changing a Class",
      scene: "conversation",
      audio: fromTurns("lc-2-audio", [
        { speaker: "Student", text: "Hi, I'd like to switch from the morning statistics class to the afternoon one." },
        { speaker: "Advisor", text: "The afternoon section is full, but there's a waiting list. Is the morning time a problem?" },
        { speaker: "Student", text: "I started a part-time job, and my shifts begin at eight." },
        { speaker: "Advisor", text: "I see. There's also an online section that you can complete at your own pace. Many working students choose it." },
        { speaker: "Student", text: "That sounds better. Can I still visit the professor's office hours?" },
        { speaker: "Advisor", text: "Yes, online students are welcome at office hours too." },
      ]),
      questions: [
        {
          id: "lc-2-q1",
          prompt: "Why does the student want to change classes?",
          options: [
            { id: "A", text: "The morning class is too difficult." },
            { id: "B", text: "Their job starts at eight." },
            { id: "C", text: "They prefer a different professor." },
            { id: "D", text: "The classroom is too far away." },
          ],
          answerId: "B",
          explanation: "The student says “my shifts begin at eight.”",
        },
        {
          id: "lc-2-q2",
          prompt: "What does the advisor recommend?",
          options: [
            { id: "A", text: "Waiting until next semester" },
            { id: "B", text: "Quitting the part-time job" },
            { id: "C", text: "Taking the online section" },
            { id: "D", text: "Joining the morning class late" },
          ],
          answerId: "C",
          explanation: "The advisor mentions an online section that “many working students choose.”",
        },
      ],
    },
  ],
};

export const listenAnnouncement: ListeningSet = {
  kind: "listen-announcement",
  items: [
    {
      id: "la-1",
      title: "Library Closure",
      scene: "announcement",
      audio: audio(
        "la-1-audio",
        "Attention, students. The main library will be closed this weekend, Saturday and Sunday, while new heating equipment is installed. The library will reopen at eight A.M. on Monday. During the closure, you can still use the online library resources, including e-books and research databases, with your student login. If you need a quiet place to study, the student center's second floor will stay open until midnight. Thank you for your patience.",
      ),
      questions: [
        {
          id: "la-1-q1",
          prompt: "What is the main purpose of the announcement?",
          options: [
            { id: "A", text: "To cancel a campus event" },
            { id: "B", text: "To inform students about a temporary closure" },
            { id: "C", text: "To promote a new student club" },
            { id: "D", text: "To remind students to pay a fee" },
          ],
          answerId: "B",
          explanation: "The announcement explains that the library will be closed this weekend.",
        },
        {
          id: "la-1-q2",
          prompt: "When will the library be closed?",
          options: [
            { id: "A", text: "This weekend" },
            { id: "B", text: "Next week" },
            { id: "C", text: "On Friday afternoon" },
            { id: "D", text: "Until further notice" },
          ],
          answerId: "A",
          explanation: "“Closed this weekend, Saturday and Sunday.”",
        },
        {
          id: "la-1-q3",
          prompt: "What can students use during the closure?",
          options: [
            { id: "A", text: "The science building" },
            { id: "B", text: "The online library resources" },
            { id: "C", text: "The library's group rooms" },
            { id: "D", text: "A nearby public library" },
          ],
          answerId: "B",
          explanation: "Students can still use “the online library resources, including e-books and research databases.”",
        },
      ],
    },
    {
      id: "la-2",
      title: "Shuttle Bus Change",
      scene: "announcement",
      audio: audio(
        "la-2-audio",
        "Good morning. Starting next Monday, the campus shuttle will stop at the new parking garage on Elm Street instead of the old lot behind the stadium. Buses will run every ten minutes during the day and every twenty minutes after six P.M. Please check the updated map on the transportation website.",
      ),
      questions: [
        {
          id: "la-2-q1",
          prompt: "What is changing next Monday?",
          options: [
            { id: "A", text: "The shuttle will stop running at night." },
            { id: "B", text: "The shuttle will use a new stop." },
            { id: "C", text: "The stadium will close." },
            { id: "D", text: "Parking will become free." },
          ],
          answerId: "B",
          explanation: "The shuttle will stop at the new garage “instead of the old lot.”",
        },
        {
          id: "la-2-q2",
          prompt: "How often will buses run in the evening?",
          options: [
            { id: "A", text: "Every five minutes" },
            { id: "B", text: "Every ten minutes" },
            { id: "C", text: "Every twenty minutes" },
            { id: "D", text: "Once an hour" },
          ],
          answerId: "C",
          explanation: "“Every twenty minutes after six P.M.”",
        },
      ],
    },
  ],
};

export const listenAcademicTalk: ListeningSet = {
  kind: "listen-academic-talk",
  items: [
    {
      id: "lat-1",
      title: "Renewable Energy",
      scene: "lecture",
      audio: audio(
        "lat-1-audio",
        "Today we're going to look at renewable energy — its advantages, and also its challenges. Let's start with solar energy. Solar power is considered a promising source because it can be generated in many regions of the world, and it has a low environmental impact once the panels are installed. Wind energy is similar: after a turbine is built, it produces electricity without burning fuel. So why don't we use renewable sources for everything? The biggest challenge is reliability. The sun doesn't always shine and the wind doesn't always blow, so the supply of electricity changes with the weather. That's why researchers are working on better batteries — to store extra energy on sunny or windy days and use it later. Next week, we'll compare the costs of these storage systems.",
      ),
      questions: [
        {
          id: "lat-1-q1",
          prompt: "What is the main topic of the talk?",
          options: [
            { id: "A", text: "The history of fossil fuels" },
            { id: "B", text: "The advantages and challenges of renewable energy" },
            { id: "C", text: "The development of electric vehicles" },
            { id: "D", text: "The impact of climate change on farming" },
          ],
          answerId: "B",
          explanation: "The speaker opens with “its advantages, and also its challenges.”",
        },
        {
          id: "lat-1-q2",
          prompt: "According to the speaker, why is solar energy considered a promising source?",
          options: [
            { id: "A", text: "It is cheaper than all other sources." },
            { id: "B", text: "It is available only in certain countries." },
            { id: "C", text: "It can be generated in many regions with low environmental impact." },
            { id: "D", text: "It can replace fossil fuels immediately." },
          ],
          answerId: "C",
          explanation: "Solar “can be generated in many regions… and it has a low environmental impact.”",
        },
        {
          id: "lat-1-q3",
          prompt: "What challenge does the speaker mention?",
          options: [
            { id: "A", text: "Supply depends on the weather." },
            { id: "B", text: "Panels are too heavy to transport." },
            { id: "C", text: "It requires large amounts of water." },
            { id: "D", text: "Turbines burn too much fuel." },
          ],
          answerId: "A",
          explanation: "“The biggest challenge is reliability… the supply changes with the weather.”",
        },
        {
          id: "lat-1-q4",
          prompt: "Why are researchers working on better batteries?",
          options: [
            { id: "A", text: "To make turbines quieter" },
            { id: "B", text: "To store extra energy for later use" },
            { id: "C", text: "To reduce the size of solar panels" },
            { id: "D", text: "To replace wind energy" },
          ],
          answerId: "B",
          explanation: "Batteries can “store extra energy on sunny or windy days and use it later.”",
        },
        {
          id: "lat-1-q5",
          prompt: "What will the class discuss next week?",
          options: [
            { id: "A", text: "The costs of energy storage systems" },
            { id: "B", text: "The history of wind power" },
            { id: "C", text: "How to install solar panels" },
            { id: "D", text: "Fossil fuel prices" },
          ],
          answerId: "A",
          explanation: "“Next week, we'll compare the costs of these storage systems.”",
        },
      ],
    },
  ],
};
