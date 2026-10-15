import { describe, expect, it } from "vitest";

import { splitLeadSentence } from "../../src/screens/lead-sentence";

describe("splitLeadSentence", () => {
  it("splits after the first sentence", () => {
    expect(
      splitLeadSentence(
        "Meta launched Muse Wonder, its first frontier model. Meta stock rose 3%.",
      ),
    ).toEqual({
      lead: "Meta launched Muse Wonder, its first frontier model.",
      rest: "Meta stock rose 3%.",
    });
  });

  it("keeps a question or quoted ending with the lead", () => {
    expect(splitLeadSentence('He said "rates stay." Markets rose.')).toEqual({
      lead: 'He said "rates stay."',
      rest: "Markets rose.",
    });
    expect(splitLeadSentence("Will the Fed cut? Traders think so.")).toEqual({
      lead: "Will the Fed cut?",
      rest: "Traders think so.",
    });
  });

  it("doesn't split at abbreviations, initials or decimals", () => {
    expect(
      splitLeadSentence(
        "The U.S. Treasury and Maybank Bhd. agreed on 2.75% with Dr. Tan and J. Smith. Then more.",
      ),
    ).toEqual({
      lead: "The U.S. Treasury and Maybank Bhd. agreed on 2.75% with Dr. Tan and J. Smith.",
      rest: "Then more.",
    });
  });

  it("doesn't split before a lower-case word", () => {
    expect(splitLeadSentence("Revenue rose 5 p.c. in March.")).toBeNull();
  });

  it("gives nothing for a single sentence", () => {
    expect(splitLeadSentence("Bank Negara held the OPR at 2.75%.")).toBeNull();
  });
});
