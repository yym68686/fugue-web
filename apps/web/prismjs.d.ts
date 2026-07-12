declare module "prismjs" {
  export type GrammarToken = Record<string, unknown>;
  export type Grammar =
    | GrammarToken
    | GrammarToken[]
    | Record<string, GrammarToken | GrammarToken[]>;

  export interface PrismStatic {
    highlight(text: string, grammar: Grammar, language: string): string;
    languages: Record<string, Grammar | undefined>;
  }

  const Prism: PrismStatic;

  export default Prism;
}

declare module "prismjs/components/*" {
  const value: unknown;

  export default value;
}
