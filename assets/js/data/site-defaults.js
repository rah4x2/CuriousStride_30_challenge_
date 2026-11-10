export const CHALLENGE = Object.freeze({
  slug: "curiousstride-30-day",
  title: "CuriousStride 30-Day Reflection Challenge",
  shortTitle: "30-Day Reflection Challenge",
  durationDays: 30,
  tagline: "30 days. One prompt a day. A little more understanding of yourself."
});

export const STAGES = Object.freeze([
  {
    id: "self-discovery",
    number: 1,
    name: "Self-Discovery",
    startDay: 1,
    endDay: 6,
    description: "Notice your present chapter, experiences and the parts of yourself that feel most authentic."
  },
  {
    id: "values-priorities",
    number: 2,
    name: "Values & Priorities",
    startDay: 7,
    endDay: 12,
    description: "Explore what matters to you and how closely your everyday choices reflect it."
  },
  {
    id: "mindset-growth",
    number: 3,
    name: "Mindset & Growth",
    startDay: 13,
    endDay: 18,
    description: "Consider how you respond to uncertainty, learning, progress and unfamiliar possibilities."
  },
  {
    id: "direction-purpose",
    number: 4,
    name: "Direction & Purpose",
    startDay: 19,
    endDay: 24,
    description: "Explore possible futures, meaningful work and your own definition of success."
  },
  {
    id: "intentional-living",
    number: 5,
    name: "Intentional Living",
    startDay: 25,
    endDay: 30,
    description: "Turn what you have noticed into practical intentions, routines and small next steps."
  }
]);

export function stageForDay(day) {
  return STAGES.find((stage) => day >= stage.startDay && day <= stage.endDay) || STAGES[0];
}

export const FINAL_QUESTIONS = Object.freeze([
  {
    id: "discovered",
    question: "What have you discovered or understood more clearly about yourself?"
  },
  {
    id: "influential",
    question: "Which reflection influenced your thinking most, and why?"
  },
  {
    id: "carry-forward",
    question: "What would you like to carry forward into your next chapter?"
  }
]);

export const DEFAULT_CONTENT = Object.freeze({
  registrationsOpen: true,
  homeHeading: "30 days to reconnect with yourself and explore what’s next.",
  homeIntro:
    "Graduation, new beginnings and changing expectations can leave us with more questions than answers. CuriousStride offers one thoughtful prompt each day to help you notice where you are, recognise what matters and explore your next chapter.",
  aboutHeading: "A quieter way to find your next step.",
  aboutBody:
    "CuriousStride was created for students, recent graduates and anyone navigating a changing chapter. It does not promise a complete transformation in 30 days. It gives you consistent space, useful questions and permission to understand yourself gradually.",
  howHeading: "One prompt. One day. Your own pace.",
  privacySummary:
    "Your journal is stored on this browser unless you explicitly turn on optional cloud sync. CuriousStride never asks for your Google password and administrators do not receive access to your private reflections.",
  benefits: [
    {
      title: "Create a gentle routine",
      description: "Build a small daily pause for reflection without an overwhelming list of questions."
    },
    {
      title: "Recognise what matters",
      description: "Explore your values, priorities, interests and the expectations influencing your choices."
    },
    {
      title: "Explore possible directions",
      description: "Consider work, learning and life possibilities without forcing yourself into one perfect answer."
    },
    {
      title: "Take a practical next step",
      description: "Turn new understanding into small actions that fit the life you actually want to build."
    }
  ],
  faqs: [
    {
      question: "Do I need to start on a particular date?",
      answer: "No. Your Day 1 begins when you start the challenge, and your personal 30-day schedule continues from there."
    },
    {
      question: "What happens if I miss a day?",
      answer: "Nothing resets. Earlier prompts remain available, so you can return when you have the time and energy to reflect."
    },
    {
      question: "Can CuriousStride read my journal?",
      answer: "In the default local-storage mode, your responses remain in your browser. The administrator dashboard shows participation information, not journal text."
    },
    {
      question: "Will my answers appear on another device?",
      answer: "Not automatically in local-storage mode. You can export a backup, or opt into cloud sync when that feature is enabled by the site owner."
    },
    {
      question: "Should I include sensitive personal information?",
      answer: "No. Avoid passwords, financial details, identification numbers, medical records and other highly sensitive information. Local browser storage is not an encrypted private vault."
    },
    {
      question: "Is this therapy or career counselling?",
      answer: "No. CuriousStride is a self-guided reflection experience. It is not a substitute for therapy, medical advice, crisis support or professional career counselling."
    }
  ]
});
