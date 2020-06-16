export interface AstMethod {
  params: string[];
  name: string;
  loc: Record<string, unknown>;
  body: Record<string, unknown>;
  statements: number[];
}
