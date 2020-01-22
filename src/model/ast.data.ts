import { AstMethod } from "./ast.method";

export class AstData {
  filePath: string;
  data: { methods: AstMethod[] }
}