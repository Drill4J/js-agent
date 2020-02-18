import { AstMethod } from './ast.method';

export class AstData {
  public filePath: string;
  public data: { methods: AstMethod[] };
  public branch: string;
}
