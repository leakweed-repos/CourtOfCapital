import { stableHash } from "./game";

export type UnitSignatureKind =
  | "entry-shield"
  | "entry-heal"
  | "turn-income"
  | "turn-cleanse"
  | "combat-expose"
  | "combat-fee"
  | "combat-snowball";

export interface UnitSignatureProfile {
  kind: UnitSignatureKind;
  valueA: number;
}

export function getUnitSignatureProfile(cardId: string): UnitSignatureProfile {
  const h = stableHash(`unit-signature:${cardId}`);
  const kindIdx = h % 7;

  if (kindIdx === 0) {
    return { kind: "entry-shield", valueA: 1 + ((h >>> 4) % 2) };
  }
  if (kindIdx === 1) {
    return { kind: "entry-heal", valueA: 1 + ((h >>> 5) % 2) };
  }
  if (kindIdx === 2) {
    return { kind: "turn-income", valueA: 10 + ((h >>> 6) % 3) * 5 };
  }
  if (kindIdx === 3) {
    return { kind: "turn-cleanse", valueA: 1 + ((h >>> 7) % 2) };
  }
  if (kindIdx === 4) {
    return { kind: "combat-expose", valueA: 1 + ((h >>> 8) % 2) };
  }
  if (kindIdx === 5) {
    return { kind: "combat-fee", valueA: 10 + ((h >>> 9) % 3) * 4 };
  }
  return { kind: "combat-snowball", valueA: 1 + ((h >>> 10) % 2) };
}

export function unitSignatureSummary(profile: UnitSignatureProfile): string {
  if (profile.kind === "entry-shield") {
    return `Signature: On summon gains ${profile.valueA} shield.`;
  }
  if (profile.kind === "entry-heal") {
    return `Signature: On summon heals weakest ally by ${profile.valueA}.`;
  }
  if (profile.kind === "turn-income") {
    return `Signature: Start of your turn gains +${profile.valueA} shares.`;
  }
  if (profile.kind === "turn-cleanse") {
    return `Signature: Start of your turn cleanses self and heals ${profile.valueA}.`;
  }
  if (profile.kind === "combat-expose") {
    return `Signature: On hit applies Exposed for ${profile.valueA} turn(s).`;
  }
  if (profile.kind === "combat-fee") {
    return `Signature: On hit gains +${profile.valueA} shares.`;
  }
  return `Signature: On survived combat gains +${profile.valueA} attack.`;
}

