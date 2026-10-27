// SAMPLE CONTENT — demo vocabulary list for the frontend phase.
import type { VocabCategory, VocabWord } from "@/lib/services/types";

export const VOCAB_CATEGORIES: { id: VocabCategory; label: string }[] = [
  { id: "academic", label: "Academic" },
  { id: "campus", label: "Campus Life" },
  { id: "science", label: "Science" },
  { id: "business", label: "Business" },
  { id: "environment", label: "Environment" },
  { id: "health", label: "Health" },
  { id: "technology", label: "Technology" },
];

export const VOCABULARY: VocabWord[] = [
  {
    id: "environment", word: "environment", partOfSpeech: "noun", pronunciation: "/ɪnˈvaɪrənmənt/",
    meaning: "the natural world around us, including air, water, land, plants, and animals",
    example: "We need to protect the environment for future generations.", category: "environment",
    related: [
      { word: "environmental", partOfSpeech: "adjective", meaning: "related to the environment" },
      { word: "environmentally", partOfSpeech: "adverb", meaning: "in a way that relates to the environment" },
      { word: "environmentalist", partOfSpeech: "noun", meaning: "a person who works to protect the environment" },
    ],
  },
  { id: "sustainable", word: "sustainable", partOfSpeech: "adjective", pronunciation: "/səˈsteɪnəbəl/", meaning: "able to continue for a long time without harming the environment", example: "The city wants more sustainable transport, like buses and bikes.", category: "environment" },
  { id: "pollutant", word: "pollutant", partOfSpeech: "noun", pronunciation: "/pəˈluːtənt/", meaning: "a substance that makes air, water, or soil dirty or harmful", example: "Trees absorb many pollutants from the air.", category: "environment" },
  { id: "analyze", word: "analyze", partOfSpeech: "verb", pronunciation: "/ˈænəlaɪz/", meaning: "to study something carefully to understand it", example: "Students analyze the data before writing their report.", category: "academic" },
  { id: "hypothesis", word: "hypothesis", partOfSpeech: "noun", pronunciation: "/haɪˈpɒθəsɪs/", meaning: "an idea that can be tested to see if it is true", example: "Her hypothesis was that plants grow faster with more light.", category: "science" },
  { id: "evidence", word: "evidence", partOfSpeech: "noun", pronunciation: "/ˈevɪdəns/", meaning: "facts or information that show something is true", example: "The author gives strong evidence for her argument.", category: "academic" },
  { id: "significant", word: "significant", partOfSpeech: "adjective", pronunciation: "/sɪɡˈnɪfɪkənt/", meaning: "large or important enough to have an effect", example: "There was a significant increase in visitors this year.", category: "academic" },
  { id: "consequently", word: "consequently", partOfSpeech: "adverb", pronunciation: "/ˈkɒnsɪkwəntli/", meaning: "as a result", example: "The road was closed; consequently, the bus was late.", category: "academic" },
  { id: "enroll", word: "enroll", partOfSpeech: "verb", pronunciation: "/ɪnˈrəʊl/", meaning: "to officially join a course or school", example: "You can enroll in the online section before Friday.", category: "campus" },
  { id: "deadline", word: "deadline", partOfSpeech: "noun", pronunciation: "/ˈdedlaɪn/", meaning: "the time or date by which something must be finished", example: "The essay deadline is next Monday at noon.", category: "campus" },
  { id: "tuition", word: "tuition", partOfSpeech: "noun", pronunciation: "/tjuˈɪʃən/", meaning: "money paid for teaching at a school or university", example: "Tuition is usually paid at the start of each semester.", category: "campus" },
  { id: "dormitory", word: "dormitory", partOfSpeech: "noun", pronunciation: "/ˈdɔːmɪtəri/", meaning: "a building where students live", example: "First-year students often live in a dormitory.", category: "campus" },
  { id: "photosynthesis", word: "photosynthesis", partOfSpeech: "noun", pronunciation: "/ˌfəʊtəʊˈsɪnθəsɪs/", meaning: "the process plants use to make food from sunlight", example: "Photosynthesis needs light, water, and carbon dioxide.", category: "science" },
  { id: "organism", word: "organism", partOfSpeech: "noun", pronunciation: "/ˈɔːɡənɪzəm/", meaning: "a living thing, such as a plant, animal, or bacterium", example: "Some organisms can live in very hot water.", category: "science" },
  { id: "revenue", word: "revenue", partOfSpeech: "noun", pronunciation: "/ˈrevənjuː/", meaning: "money that a business receives from sales", example: "The café's revenue grew after it opened online orders.", category: "business" },
  { id: "negotiate", word: "negotiate", partOfSpeech: "verb", pronunciation: "/nɪˈɡəʊʃieɪt/", meaning: "to discuss something to reach an agreement", example: "They negotiated a lower price for the equipment.", category: "business" },
  { id: "invest", word: "invest", partOfSpeech: "verb", pronunciation: "/ɪnˈvest/", meaning: "to put money or time into something to get a benefit later", example: "The company invested in training for new staff.", category: "business" },
  { id: "nutrition", word: "nutrition", partOfSpeech: "noun", pronunciation: "/njuˈtrɪʃən/", meaning: "the food your body needs to stay healthy", example: "Good nutrition helps students concentrate.", category: "health" },
  { id: "symptom", word: "symptom", partOfSpeech: "noun", pronunciation: "/ˈsɪmptəm/", meaning: "a sign of an illness", example: "A cough is a common symptom of a cold.", category: "health" },
  { id: "well-being", word: "well-being", partOfSpeech: "noun", pronunciation: "/ˌwelˈbiːɪŋ/", meaning: "the state of being healthy and happy", example: "Exercise is good for both physical and mental well-being.", category: "health" },
  { id: "device", word: "device", partOfSpeech: "noun", pronunciation: "/dɪˈvaɪs/", meaning: "a machine or tool made for a special purpose", example: "Please turn off all devices during the exam.", category: "technology" },
  { id: "innovation", word: "innovation", partOfSpeech: "noun", pronunciation: "/ˌɪnəˈveɪʃən/", meaning: "a new idea, method, or product", example: "Battery innovation is important for renewable energy.", category: "technology" },
  { id: "efficient", word: "efficient", partOfSpeech: "adjective", pronunciation: "/ɪˈfɪʃənt/", meaning: "working well without wasting time or energy", example: "LED lights are more efficient than old bulbs.", category: "technology" },
  { id: "renewable", word: "renewable", partOfSpeech: "adjective", pronunciation: "/rɪˈnjuːəbəl/", meaning: "able to be replaced naturally, like sun or wind energy", example: "Solar power is a renewable source of energy.", category: "environment" },
];
