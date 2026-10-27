// SAMPLE CONTENT — hand-written demo items, not AI-generated and not official TOEFL material.
import type { CompleteWordsSet, ReadingSet } from "../../../lib/services/types";

export const completeTheWords: CompleteWordsSet = {
  kind: "complete-the-words",
  items: [
    {
      id: "ctw-1",
      title: "Photoperiodism",
      // "visible[missing]" — the learner types the missing letters.
      text:
        "Photoperiodism refers to the physiological response of organisms to the length of day and night. By sen[sing] changes i[n] the dura[tion] of li[ght] and da[rk] periods, pla[nts] can ti[me] their gro[wth] stages t[o] occur wh[en] environmental conditions are favorable. This phenomenon affects the timing of flowering, seed germination, and other developmental processes.",
    },
    {
      id: "ctw-2",
      title: "Honeybees and Pollination",
      text:
        "The honeybee is one of the most important pollinators on Earth. When a bee vis[its] a flower, poll[en] sticks t[o] its body a[nd] is carr[ied] to th[e] next flo[wer]. Th[is] process hel[ps] plants prod[uce] seeds and fruit. Without bees, many crops would struggle to grow, and food prices could rise.",
    },
  ],
};

export const readInDailyLife: ReadingSet = {
  kind: "read-in-daily-life",
  items: [
    {
      id: "rdl-1",
      title: "Change in Book Club Meeting",
      document: {
        type: "email",
        from: "laura.bennett@westside.example",
        to: "bookclub@westside.example",
        subject: "Change in Book Club Meeting",
        body: [
          "Dear Book Club Members,",
          "I'm writing to let you know that our upcoming book club meeting has been changed to Friday, May 19 at 6:30 P.M. The change was necessary due to a scheduling conflict at our original venue. We will now meet in Room B2 of the Westside Library, which is located on the lower level near the community events entrance.",
          "Please be aware that the library is hosting a local author talk that evening, so parking may be limited. I recommend arriving a bit early or carpooling if possible. In addition to your copy of the book, feel free to bring any notes or questions you'd like to explore with the group. Light refreshments will be provided.",
        ],
        signOff: "Warm regards,\nLaura Bennett",
      },
      questions: [
        {
          id: "rdl-1-q1",
          prompt: "What is the main purpose of the email?",
          options: [
            { id: "A", text: "To recommend a book" },
            { id: "B", text: "To reschedule a meeting" },
            { id: "C", text: "To share discussion points" },
            { id: "D", text: "To apologize for a change in plans" },
          ],
          answerId: "B",
          explanation: "The first sentence says the meeting “has been changed to Friday, May 19.” The rest of the email gives details about the new time and place.",
        },
        {
          id: "rdl-1-q2",
          prompt: "Where will the group meet?",
          options: [
            { id: "A", text: "At the original venue" },
            { id: "B", text: "In the library parking area" },
            { id: "C", text: "In Room B2 of the Westside Library" },
            { id: "D", text: "At a local author's home" },
          ],
          answerId: "C",
          explanation: "The email says “We will now meet in Room B2 of the Westside Library.”",
        },
        {
          id: "rdl-1-q3",
          prompt: "Why does Laura suggest arriving early?",
          options: [
            { id: "A", text: "Refreshments will run out quickly." },
            { id: "B", text: "Parking may be limited because of another event." },
            { id: "C", text: "The room is difficult to find." },
            { id: "D", text: "The meeting will start before 6:30 P.M." },
          ],
          answerId: "B",
          explanation: "She mentions an author talk the same evening, so “parking may be limited.”",
        },
      ],
    },
    {
      id: "rdl-2",
      title: "Recreation Center Summer Hours",
      document: {
        type: "notice",
        heading: "Campus Recreation Center — Summer Hours",
        body: [
          "From June 1 to August 15, the Recreation Center will open from 7:00 A.M. to 8:00 P.M. on weekdays and from 9:00 A.M. to 5:00 P.M. on weekends.",
          "The swimming pool will be closed for cleaning during the first week of July. Fitness classes will continue as normal, but you must reserve a place online at least 24 hours in advance.",
          "Lockers must be emptied every evening. Items left overnight will be taken to the front desk.",
        ],
        footer: "Questions? Visit the front desk on the ground floor.",
      },
      questions: [
        {
          id: "rdl-2-q1",
          prompt: "What must students do to join a fitness class?",
          options: [
            { id: "A", text: "Arrive at 7:00 A.M." },
            { id: "B", text: "Reserve a place online a day before" },
            { id: "C", text: "Pay at the front desk" },
            { id: "D", text: "Bring their own locker key" },
          ],
          answerId: "B",
          explanation: "The notice says you must reserve a place online at least 24 hours in advance.",
        },
        {
          id: "rdl-2-q2",
          prompt: "What happens to items left in lockers overnight?",
          options: [
            { id: "A", text: "They are thrown away." },
            { id: "B", text: "They are moved to the pool area." },
            { id: "C", text: "They are taken to the front desk." },
            { id: "D", text: "They stay in the locker until August." },
          ],
          answerId: "C",
          explanation: "“Items left overnight will be taken to the front desk.”",
        },
      ],
    },
    {
      id: "rdl-3",
      title: "Study Group Messages",
      document: {
        type: "chat",
        title: "Biology 101 — Study Group",
        messages: [
          { sender: "Maya", text: "Hi all! Can we move tomorrow's session from 4 to 5? My lab runs late.", time: "6:12 PM" },
          { sender: "Daniel", text: "5 works for me. Same room in the science building?", time: "6:15 PM" },
          { sender: "Maya", text: "Room 210 is booked at 5, so let's use the library study room instead.", time: "6:16 PM" },
          { sender: "Priya", text: "Sounds good. I'll bring the practice quiz from last week.", time: "6:20 PM" },
        ],
      },
      questions: [
        {
          id: "rdl-3-q1",
          prompt: "Why does Maya want to change the time?",
          options: [
            { id: "A", text: "Her lab finishes late." },
            { id: "B", text: "Room 210 is closed." },
            { id: "C", text: "Daniel cannot come at 4." },
            { id: "D", text: "She needs time to print a quiz." },
          ],
          answerId: "A",
          explanation: "Maya writes “My lab runs late.”",
        },
        {
          id: "rdl-3-q2",
          prompt: "Where will the group most likely meet?",
          options: [
            { id: "A", text: "Room 210" },
            { id: "B", text: "The science building lobby" },
            { id: "C", text: "The library study room" },
            { id: "D", text: "Maya's lab" },
          ],
          answerId: "C",
          explanation: "Room 210 is booked at 5, so Maya suggests the library study room and Priya agrees.",
        },
      ],
    },
  ],
};

export const readAcademicPassage: ReadingSet = {
  kind: "read-academic-passage",
  items: [
    {
      id: "rap-1",
      title: "The Role of Urban Green Spaces",
      paragraphs: [
        "Urban green spaces, such as parks, community gardens, and green rooftops, play an increasingly important role in modern cities. As urban populations grow, these natural areas provide environmental, social, and economic benefits that contribute to healthier and more sustainable communities.",
        "One major benefit of urban green spaces is their ability to improve air quality. Trees and plants absorb carbon dioxide and other pollutants, helping to reduce the concentration of harmful substances in the air. This can lead to lower rates of respiratory problems, especially in densely populated areas where air pollution is a significant concern.",
        "In addition to environmental benefits, urban green spaces also support mental and physical well-being. Studies have shown that spending time in natural environments can reduce stress, improve mood, and encourage physical activity. Parks provide places for people to exercise, socialize, and take a break from the fast pace of city life.",
        "Finally, urban green spaces can have positive economic effects. They can increase nearby property values, attract visitors, and create jobs related to maintenance and urban planning. For these reasons, city planners are increasingly recognizing the importance of preserving and expanding green spaces as a key part of urban development.",
      ],
      questions: [
        {
          id: "rap-1-q1",
          prompt: "What is the main idea of the passage?",
          options: [
            { id: "A", text: "The history of urban development" },
            { id: "B", text: "The benefits of urban green spaces" },
            { id: "C", text: "The challenges of maintaining city parks" },
            { id: "D", text: "The role of tourism in modern cities" },
          ],
          answerId: "B",
          explanation: "Each paragraph describes a benefit — environmental, social, or economic — of green spaces.",
        },
        {
          id: "rap-1-q2",
          prompt: "According to the passage, how do green spaces help improve air quality?",
          options: [
            { id: "A", text: "They reduce traffic in the city." },
            { id: "B", text: "They absorb carbon dioxide and other pollutants." },
            { id: "C", text: "They lower the temperature of buildings." },
            { id: "D", text: "They increase the use of public transportation." },
          ],
          answerId: "B",
          explanation: "Paragraph 2: “Trees and plants absorb carbon dioxide and other pollutants.”",
        },
        {
          id: "rap-1-q3",
          prompt: "What does the passage suggest about the effect of green spaces on people's mental health?",
          options: [
            { id: "A", text: "They can reduce stress and improve mood." },
            { id: "B", text: "They mainly help people sleep better." },
            { id: "C", text: "They have no measurable effect." },
            { id: "D", text: "They are only helpful for children." },
          ],
          answerId: "A",
          explanation: "Paragraph 3 says time in nature “can reduce stress, improve mood, and encourage physical activity.”",
        },
        {
          id: "rap-1-q4",
          prompt: "The word “densely” in paragraph 2 is closest in meaning to:",
          options: [
            { id: "A", text: "quietly" },
            { id: "B", text: "recently" },
            { id: "C", text: "crowdedly" },
            { id: "D", text: "partly" },
          ],
          answerId: "C",
          explanation: "A densely populated area has many people living close together — it is crowded.",
        },
        {
          id: "rap-1-q5",
          prompt: "Which economic effect of green spaces is NOT mentioned?",
          options: [
            { id: "A", text: "Higher property values" },
            { id: "B", text: "New jobs in maintenance" },
            { id: "C", text: "Lower taxes for residents" },
            { id: "D", text: "More visitors to the area" },
          ],
          answerId: "C",
          explanation: "The last paragraph mentions property values, visitors, and jobs — but not taxes.",
        },
      ],
    },
  ],
};
