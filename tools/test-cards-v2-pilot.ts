import assert from "node:assert/strict";
import { getCardEffectDescriptor } from "../src/shared/card-effects.ts";
import { CARD_LIBRARY, getCatalogCard } from "../src/shared/card-catalog.ts";
import {
  CARD_CATALOG_V2,
  buildCardImpactTextV2,
  cardV2ToLegacy,
  getCardV2ById,
  hasLegacyExplicitUnitRuntime,
  V2_MIGRATION_REPORT,
  validateCardCatalogV2,
} from "../src/shared/cards/index.ts";

const PILOT_V2_IDS = [
  "stonk_charger",
  "picket_marshal",
  "spread_sniper",
  "compliance_clerk",
  "public_defender",
  "shadow_broker",
] as const;

function testPilotDescriptionsUseV2Builder(): void {
  for (const id of PILOT_V2_IDS) {
    const cardV2 = getCardV2ById(id);
    assert.ok(cardV2, `Expected V2 pilot card for ${id}`);
    const descriptor = getCardEffectDescriptor(id);
    assert.equal(descriptor.summary, buildCardImpactTextV2(cardV2), `Card impact for ${id} should come from V2 builder`);
    assert.equal(descriptor.targetRule, cardV2.impactTargetRule ?? "none", `Pilot V2 card ${id} targetRule parity`);
    assert.equal(descriptor.summary.includes("Signature:"), false, `${id} should not use hash signature text`);
  }
}

function testFullCatalogCoverageInV2(): void {
  const legacyIds = Object.keys(CARD_LIBRARY);
  assert.equal(CARD_CATALOG_V2.length, legacyIds.length, "V2 catalog should fully cover legacy catalog size");
  for (const id of legacyIds) {
    const cardV2 = getCardV2ById(id);
    assert.ok(cardV2, `Missing V2 card for legacy id ${id}`);
  }

  const migratedFallbackId = "rulebook_slasher";
  const migratedDescriptor = getCardEffectDescriptor(migratedFallbackId);
  assert.equal(migratedDescriptor.summary.includes("Signature:"), false, "Migrated fallback unit should no longer use signature text");

  const unresolvedExplicitId = "spread_sniper";
  const unresolvedExplicitV2 = getCardV2ById(unresolvedExplicitId);
  assert.ok(unresolvedExplicitV2, `Expected V2 card for ${unresolvedExplicitId}`);
  assert.equal(hasLegacyExplicitUnitRuntime(unresolvedExplicitId), true);
  assert.equal(
    (unresolvedExplicitV2.triggers ?? []).length > 0,
    true,
    "Pilot explicit cards may already have V2 triggers after Phase 3/4",
  );
}

function sortTraits(traits: readonly string[]): string[] {
  return [...traits].sort();
}

function testAdapterParityForPilotCoreFields(): void {
  for (const id of PILOT_V2_IDS) {
    const cardV2 = getCardV2ById(id);
    assert.ok(cardV2, `Expected V2 pilot card for ${id}`);
    const adapted = cardV2ToLegacy(cardV2);
    const legacy = getCatalogCard(id);

    assert.equal(adapted.id, legacy.id, `${id}: id parity`);
    assert.equal(adapted.name, legacy.name, `${id}: name parity`);
    assert.equal(adapted.faction, legacy.faction, `${id}: faction parity`);
    assert.equal(adapted.type, legacy.type, `${id}: type parity`);
    assert.equal(adapted.costShares, legacy.costShares, `${id}: cost parity`);
    assert.equal(adapted.dirtyPower ?? 0, legacy.dirtyPower ?? 0, `${id}: dirtyPower parity`);
    assert.equal(adapted.attack ?? null, legacy.attack ?? null, `${id}: attack parity`);
    assert.equal(adapted.health ?? null, legacy.health ?? null, `${id}: health parity`);
    assert.deepEqual(sortTraits(adapted.traits), sortTraits(legacy.traits), `${id}: trait parity`);
  }
}

function testCatalogV2ValidationPasses(): void {
  const issues = validateCardCatalogV2(CARD_CATALOG_V2);
  assert.equal(issues.length, 0, `Expected no V2 validation issues, got ${issues.length}`);
}

function main(): void {
  testPilotDescriptionsUseV2Builder();
  testFullCatalogCoverageInV2();
  testAdapterParityForPilotCoreFields();
  testCatalogV2ValidationPasses();
  console.log(
    `V2 pilot/full-catalog regression tests passed. ` +
      `Catalog size: ${CARD_CATALOG_V2.length}. ` +
      `Residual legacy runtime: explicit-units=${V2_MIGRATION_REPORT.unresolvedLegacyExplicitUnitRuntimeCards}, ` +
      `non-units=${V2_MIGRATION_REPORT.unresolvedLegacyNonUnitRuntimeCards}.`,
  );
}

main();
