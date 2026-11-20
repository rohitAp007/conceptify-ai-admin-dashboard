import { describe, expect, it } from "vitest";
import {
  bottlenecks,
  ConceptStat,
  extractConceptsFromMaterial,
  isBottleneck,
  normalizeText,
  parseConcepts,
  scoreConfidenceDiagnostic,
  slug,
  strugglingRatio,
  validateExtractedConcepts,
} from "../lib/heatmap";

const s = (
  knows: number,
  developing: number,
  struggles: number,
  id = "a"
): ConceptStat => ({ conceptId: id, name: id, knows, developing, struggles });

describe("heatmap & bottleneck logic", () => {
  it("ratio handles empty", () => expect(strugglingRatio(s(0, 0, 0))).toBe(0));

  it("flags strictly more than 50%", () => {
    expect(isBottleneck(s(1, 1, 2))).toBe(false); // exactly 50%
    expect(isBottleneck(s(1, 1, 3))).toBe(true);
  });

  it("ignores tiny samples", () =>
    expect(isBottleneck(s(0, 0, 1))).toBe(false));

  it("sorts worst first", () => {
    const r = bottlenecks([
      s(1, 0, 3, "x"),
      s(0, 0, 5, "y"),
      s(5, 0, 0, "z"),
    ]);
    expect(r.map((c) => c.conceptId)).toEqual(["y", "x"]);
  });

  it("slug and parseConcepts dedupe, trim and cap", () => {
    expect(slug(" Force & Mass ")).toBe("force_mass");
    const out = parseConcepts(
      "Force\n force \n\nMass\n" +
        Array.from({ length: 20 }, (_, i) => `C${i}`).join("\n")
    );
    expect(out[0]).toMatchObject({ id: "force", name: "Force" });
    expect(out.length).toBe(12);
  });
});

describe("concept validation & ephemeral extraction", () => {
  it("accepts 3-5 concepts and removes cyclic/unknown prereqs", () => {
    const out = validateExtractedConcepts({
      concepts: [
        { id: "A", name: "Alpha", prereqIds: ["b", "ghost", "a"], summary: "s1" },
        { id: "B", name: "Beta", prereqIds: ["a"], summary: "s2" },
        { id: "C", name: "Gamma", prereqIds: ["b"], summary: "s3" },
      ],
    });
    expect(out.length).toBe(3);
    expect(out[0].id).toBe("a");
    expect(out[0].prereqIds).toEqual(["b"]); // keeps a -> b
    expect(out[1].prereqIds).toEqual([]); // drops cyclic b -> a
    expect(out[2].prereqIds).toEqual(["b"]);
  });

  it("rejects fewer than 3 or more than 5 concepts", () => {
    expect(() =>
      validateExtractedConcepts({
        concepts: [
          { id: "a", name: "A", prereqIds: [], summary: "" },
          { id: "b", name: "B", prereqIds: [], summary: "" },
        ],
      })
    ).toThrow();
    expect(() =>
      validateExtractedConcepts({
        concepts: Array.from({ length: 6 }, (_, i) => ({
          id: `c${i}`,
          name: `Concept ${i}`,
          prereqIds: [],
          summary: "",
        })),
      })
    ).toThrow();
  });

  it("normalizes text deterministically and extracts 4 ephemeral concepts", async () => {
    expect(normalizeText("  Newton   Second\nLaw ")).toBe("newton second law");
    const res = await extractConceptsFromMaterial({
      title: "Polity Writs",
      text: "Habeas Corpus protects personal liberty\nMandamus commands public duty\nProhibition stops excess jurisdiction\nCertiorari quashes ultra vires orders",
      language: "en",
    });
    expect(res.ephemeralDeleted).toBe(true);
    expect(res.docHash).toHaveLength(64);
    expect(res.concepts.length).toBe(4);
  });
});

describe("confidence-weighted diagnostic scoring", () => {
  it("scores all 3 sure + correct as 100 KNOWS", () => {
    expect(
      scoreConfidenceDiagnostic([
        { difficulty: 1, correct: true, sure: true },
        { difficulty: 2, correct: true, sure: true },
        { difficulty: 3, correct: true, sure: true },
      ])
    ).toEqual({ score: 100, status: "KNOWS" });
  });

  it("caps all 3 guessed + correct at 50 DEVELOPING (never KNOWS)", () => {
    expect(
      scoreConfidenceDiagnostic([
        { difficulty: 1, correct: true, sure: false },
        { difficulty: 2, correct: true, sure: false },
        { difficulty: 3, correct: true, sure: false },
      ])
    ).toEqual({ score: 50, status: "DEVELOPING" });
  });

  it("scores all wrong as 0 STRUGGLES", () => {
    expect(
      scoreConfidenceDiagnostic([
        { difficulty: 1, correct: false, sure: true },
        { difficulty: 2, correct: false, sure: false },
        { difficulty: 3, correct: false, sure: true },
      ])
    ).toEqual({ score: 0, status: "STRUGGLES" });
  });
});
