import upath from 'upath';

export default function normalizePath(path: string): string {
  return upath.normalize(path).replace(/^\W+/, '');
}
