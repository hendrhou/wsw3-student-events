import assert from "node:assert/strict";
import { test } from "node:test";
import { dashboards, generate } from "./dashboards.mjs";

test("generated dashboards are current, provisioned, and have stable unique identities", () => {
  generate(true);
  assert.equal(new Set(dashboards.map(({ uid }) => uid)).size, 5);
  for (const dashboard of dashboards) {
    assert.equal(dashboard.editable, false);
    assert.equal(new Set(dashboard.panels.map(({ id }) => id)).size, dashboard.panels.length);
    assert.ok(dashboard.templating.list.some(({ name }) => name === "environment"));
    for (const panel of dashboard.panels) {
      assert.ok(panel.gridPos.x + panel.gridPos.w <= 24);
      assert.ok(["prometheus", "loki"].includes(panel.datasource.uid));
      assert.ok(panel.targets.every(({ expr }) => expr.length > 0));
    }
  }
});