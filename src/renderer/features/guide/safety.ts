/**
 * Deterministic safety handling. This copy is fixed in code so it never drifts between generations,
 * and a message that triggers it is not forwarded to the guide agent (see docs/features/agent.md).
 */
export const crisisCopy =
  "This app is not emergency support. If you might hurt yourself or someone else, or you cannot stay safe, stop this session now and contact local emergency services or a trusted person nearby. I can pause here.";

const crisisPatterns = [
  /\bkill(ing)? myself\b/i,
  /\bsuicid/i,
  /\bend (it all|my life)\b/i,
  /\b(hurt|harm|cut)(ing)? myself\b/i,
  /\bself[- ]?harm/i,
  /\b(want|wanna|going) to die\b/i,
  /\bcan(no|')?t (stay|keep myself) safe\b/i,
  /\bi(?:'m| am)? (?:going to|want to|will|might) (?:hurt|harm|kill) (?:someone|somebody|others|him|her|them)\b/i
];

export function signalsCrisis(text: string) {
  return crisisPatterns.some((pattern) => pattern.test(text));
}
