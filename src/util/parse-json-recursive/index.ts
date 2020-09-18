// TODO would be much better to stringify JSON only ONCE, instead of multiple netsted levels. Suggest backend API enhancement
export default function parseJsonRecursive(rawMessage: string, l = 0): unknown {
  if (l > 3) {
    // magic number due to unknown number of nested messages
    throw new Error(`Max recursive parse depth reached.\n   Not-parsed content: ${rawMessage}`);
  }
  const result = JSON.parse(rawMessage);
  // check both fields due to naming inconsistency on different message levels
  const content = result.text || result.message;
  const isContentJSON = content && (content[0] === '{' || content[0] === '[');
  if (isContentJSON) {
    // note that parsed data either from .text or .message gets assigned to "message" field
    result.message = parseJsonRecursive(content, l + 1);
    delete result.text;
  }
  return result;
}
