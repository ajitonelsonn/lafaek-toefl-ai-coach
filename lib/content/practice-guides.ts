import type { PracticeSlug } from "@/lib/config/practice-types";

export interface PracticeGuide {
  instructions: string[];
  tips: string[];
}

export const PRACTICE_GUIDES: Record<PracticeSlug, PracticeGuide> = {
  "complete-the-words": {
    instructions: [
      "Read the paragraph and type the missing letters in each blank.",
      "Each box is one missing letter. Type and the cursor moves to the next box.",
      "Use the context to find the correct word and spelling.",
    ],
    tips: ["Look at the words around each blank and the meaning of the sentence.", "Think about common word endings like -ing, -tion and -ed."],
  },
  "read-in-daily-life": {
    instructions: ["Read the text carefully.", "Answer each question about it.", "Check an answer to see the explanation, or finish to see all results."],
    tips: ["Look for the overall reason the message was written.", "Focus on the main idea first, then the details."],
  },
  "read-academic-passage": {
    instructions: ["Read the passage on the left.", "Answer the questions on the right.", "You can move between questions at any time."],
    tips: ["Read the first sentence of each paragraph to find the main ideas.", "For vocabulary questions, replace the word with each option and reread the sentence."],
  },
  "listen-choose-response": {
    instructions: [
      "Listen to the audio. You will hear a short statement or question.",
      "Choose the best response from the four options.",
      "You may listen only once (same as the real test).",
    ],
    tips: ["Listen for the key idea: is it a request, a suggestion, or a question?", "Choose the reply that sounds most natural in a real conversation."],
  },
  "listen-conversation": {
    instructions: [
      "Listen to the conversation.",
      "Answer the questions based on what you hear.",
      "You may listen only once (same as the real test).",
      "The questions appear after the audio finishes.",
    ],
    tips: ["Listen for places, times, reasons and suggestions.", "Take short notes while listening."],
  },
  "listen-announcement": {
    instructions: [
      "Listen to the announcement.",
      "Answer the questions based on what you hear.",
      "You may listen only once (same as the real test).",
      "The questions appear after the audio finishes.",
    ],
    tips: ["Listen for dates, numbers and changes to plans.", "Ask yourself: who is the announcement for, and what should they do?"],
  },
  "listen-academic-talk": {
    instructions: [
      "Listen to the academic talk.",
      "Use the notes area if you want.",
      "Answer the questions based on what you hear.",
      "The questions appear after the audio finishes.",
    ],
    tips: ["Focus on the main idea, supporting details and the speaker's purpose.", "Write key words, examples and numbers in your notes."],
  },
  "build-sentence": {
    instructions: [
      "Read the first speaker's sentence.",
      "Click the words in order. Each word fills the next blank (you can also drag a word to a blank).",
      "Click a word in a blank to send it back.",
      "Select Check when every blank is filled.",
    ],
    tips: ["Look for the question opener, then subject + verb + object.", "Inside indirect questions (Do you know if…), use statement word order."],
  },
  "write-email": {
    instructions: ["Read the situation.", "Write an email that does all three tasks.", "Use complete sentences and a polite tone."],
    tips: ["A good email has a clear purpose, relevant details, polite language and complete sentences.", "Organize your ideas into short paragraphs."],
  },
  "academic-discussion": {
    instructions: ["Read the professor's question and the two student posts.", "Write your own response.", "Aim for at least 100 words."],
    tips: ["Clearly state your opinion.", "Give specific reasons and examples.", "Respond to the ideas of the other students."],
  },
  "listen-repeat": {
    instructions: ["Listen to the audio.", "Repeat exactly what you hear.", "You will hear the audio only once.", "Record your response before the time ends."],
    tips: ["Listen to the pronunciation, rhythm and pauses.", "Start speaking right after the audio ends.", "Speak at a normal speed."],
  },
  "take-interview": {
    instructions: ["Listen to each interviewer question.", "Record your answer before the time ends.", "Answer all four questions."],
    tips: ["Answer the question directly.", "Give a reason or an example.", "Keep speaking until the timer ends."],
  },
};
