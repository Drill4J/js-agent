import { AstMethod } from './ast-method';

export interface AstData {
  filePath: string;
  data: { methods: AstMethod[] };
  branch: string;
}
