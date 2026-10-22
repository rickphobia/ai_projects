// The Briefing, Chat answers and Simple summaries still being written on the server, remembered
// in this browser so the app can follow them again after the page was closed. The server keeps writing either
// way; this only lets the page show it. Storage can be missing or refuse (a private window),
// and then the page just doesn't know, as before.

export interface PendingAnswer {
  jobId: string;
  // The question as the owner typed it; it isn't saved on the server until it is answered.
  question: string;
}

export interface PendingJobs {
  briefing(): string | null;
  setBriefing(jobId: string | null): void;
  answer(chatId: number): PendingAnswer | null;
  setAnswer(chatId: number, answer: PendingAnswer | null): void;
  // The job writing this Item's Simple summary.
  summary(itemId: number): string | null;
  setSummary(itemId: number, jobId: string | null): void;
}

const briefingKey = "rss-news.pending-briefing";
const answerKey = (chatId: number): string =>
  `rss-news.pending-answer.${String(chatId)}`;
const summaryKey = (itemId: number): string =>
  `rss-news.pending-summary.${String(itemId)}`;

export function storedPendingJobs(
  storage: () => Storage = () => localStorage,
): PendingJobs {
  const read = (key: string): string | null => {
    try {
      return storage().getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string | null): void => {
    try {
      if (value === null) storage().removeItem(key);
      else storage().setItem(key, value);
    } catch {
      // Not remembered: coming back won't show the job, but it still runs and is saved.
    }
  };
  return {
    briefing: () => read(briefingKey),
    setBriefing: (jobId) => {
      write(briefingKey, jobId);
    },
    answer: (chatId) => {
      const text = read(answerKey(chatId));
      if (text === null) return null;
      try {
        const parsed = JSON.parse(text) as Partial<PendingAnswer>;
        return typeof parsed.jobId === "string" &&
          typeof parsed.question === "string"
          ? { jobId: parsed.jobId, question: parsed.question }
          : null;
      } catch {
        return null;
      }
    },
    setAnswer: (chatId, answer) => {
      write(answerKey(chatId), answer === null ? null : JSON.stringify(answer));
    },
    summary: (itemId) => read(summaryKey(itemId)),
    setSummary: (itemId, jobId) => {
      write(summaryKey(itemId), jobId);
    },
  };
}
