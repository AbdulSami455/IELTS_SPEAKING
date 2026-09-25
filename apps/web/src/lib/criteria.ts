// One source of truth for the four IELTS speaking criteria. Colors are a
// validated categorical palette (CVD-safe, >= 3:1 on white) and follow the
// criterion everywhere it appears: charts, skill bars, and report cards.
export const OVERALL_COLOR = "#00856f";

export const CRITERIA = [
  {
    key: "fluency_and_coherence",
    label: "Fluency & coherence",
    short: "Fluency",
    abbr: "F",
    color: "#2a78d6",
  },
  {
    key: "lexical_resource",
    label: "Lexical resource",
    short: "Vocabulary",
    abbr: "V",
    color: "#eb6834",
  },
  {
    key: "grammatical_range_and_accuracy",
    label: "Grammatical range & accuracy",
    short: "Grammar",
    abbr: "G",
    color: "#4a3aa7",
  },
  {
    key: "pronunciation",
    label: "Pronunciation",
    short: "Pronunciation",
    abbr: "P",
    color: "#d55181",
  },
] as const;

export function criterionMeta(key: string) {
  return CRITERIA.find((item) => item.key === key);
}

export function criterionColor(key: string): string {
  return criterionMeta(key)?.color ?? OVERALL_COLOR;
}
