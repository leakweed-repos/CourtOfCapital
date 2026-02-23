import assert from "node:assert/strict";
import { CARD_LIBRARY } from "../src/shared/card-catalog.ts";
import { getCardEffectDescriptor } from "../src/shared/card-effects.ts";
import { getCardPreview } from "../src/shared/cards.ts";
import { CARD_CATALOG_V2, V2_MIGRATION_REPORT, validateCardCatalogV2 } from "../src/shared/cards/index.ts";
import { canPlaceCardInLane } from "../src/server/game/models.ts";
import { isJudgeSpecialistCard } from "../src/shared/placement.ts";

function main(): void {
  const issues = validateCardCatalogV2(CARD_CATALOG_V2);
  assert.equal(issues.length, 0, `V2 catalog validation failed:\n${issues.map((one) => `${one.cardId ?? "?"} ${one.path}: ${one.message}`).join("\n")}`);

  const legacyIds = Object.keys(CARD_LIBRARY);
  assert.equal(CARD_CATALOG_V2.length, legacyIds.length, "V2 and legacy adapter catalog sizes must match");

  for (const id of legacyIds) {
    const descriptor = getCardEffectDescriptor(id);
    assert.ok(descriptor.summary.length > 0, `Missing Card impact for ${id}`);
    assert.equal(descriptor.summary.includes("Signature:"), false, `Signature text should not appear in V2 effect text (${id})`);
    const preview = getCardPreview(id);
    assert.ok(preview.courtRecordText.startsWith("Identikit: "), `Court Record must start with Identikit for ${id}`);
    assert.ok(preview.courtRecordText.includes(" Case: "), `Court Record must include Case section for ${id}`);
    assert.equal(preview.fullEffectShortText.includes("Row:"), false, `Quick effect text should not use old 'Row:' wording (${id})`);
    assert.equal(
      /Mechanics:\s*(Role:|Faction passive:|Resistance:)/i.test(preview.fullEffectShortText),
      false,
      `Quick effect text should not leak deprecated generated mechanics copy (${id})`,
    );
  }

  const factCheckerPreview = getCardPreview("fact_checker_ape");
  assert.ok(
    factCheckerPreview.fullEffectShortText.includes("Put in back row"),
    "Fact Checker Ape preview row text should match strict backline placement.",
  );
  assert.equal(canPlaceCardInLane("fact_checker_ape", "front"), false, "Fact Checker Ape must not be placeable in front row.");
  assert.equal(canPlaceCardInLane("fact_checker_ape", "back"), true, "Fact Checker Ape must be placeable in back row.");

  const courtLiaisonPreview = getCardPreview("court_liaison");
  assert.ok(
    (courtLiaisonPreview.specialsLine ?? "").includes("Judge Green specialist"),
    "Court Liaison preview should identify Green Judge specialist status.",
  );
  assert.ok(
    courtLiaisonPreview.fullEffectShortText.includes("Judge slot: Judge green slot"),
    "Court Liaison quick effect text should include Judge slot.",
  );
  assert.ok(
    courtLiaisonPreview.fullEffectShortText.includes("Judge mechanics:"),
    "Court Liaison quick effect text should include Judge mechanics summary.",
  );
  const lenderPreview = getCardPreview("lender_last_resort");
  assert.ok(lenderPreview.fullEffectShortText.includes("Effects: Heal"), "Lender of Last Resort preview should surface Heal in Effects.");

  const backLaneUnits = CARD_CATALOG_V2.filter((card) => card.kind === "unit" && card.lane === "back");
  for (const card of backLaneUnits) {
    assert.equal(canPlaceCardInLane(card.id, "front"), false, `${card.id} (lane=back) must not be placeable in front row.`);
    assert.equal(canPlaceCardInLane(card.id, "back"), true, `${card.id} (lane=back) must be placeable in back row.`);
    const preview = getCardPreview(card.id);
    if (isJudgeSpecialistCard(card.id)) {
      assert.ok(/Put in Judge (green|blue)/.test(preview.fullEffectShortText), `${card.id} quick effect text should say Judge slot.`);
    } else {
      assert.ok(preview.fullEffectShortText.includes("Put in back row"), `${card.id} quick effect text should say back row.`);
    }
  }

  const nonUnits = CARD_CATALOG_V2.filter((card) => card.kind !== "unit");
  for (const card of nonUnits) {
    const preview = getCardPreview(card.id);
    assert.equal(preview.fullEffectShortText.includes("Put in:"), false, `${card.id} non-unit quick effect must not use Put in.`);
    assert.equal(/^\s*(front row|back row|both rows)\b/i.test(preview.cardImpactLine), false, `${card.id} non-unit Card impact must not start with row labels.`);
  }

  console.log(
    `cards:validate OK | cards=${CARD_CATALOG_V2.length} | residual explicit-unit runtime=${V2_MIGRATION_REPORT.unresolvedLegacyExplicitUnitRuntimeCards} | residual non-unit runtime=${V2_MIGRATION_REPORT.unresolvedLegacyNonUnitRuntimeCards}`,
  );
}

main();
