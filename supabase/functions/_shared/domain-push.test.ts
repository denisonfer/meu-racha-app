import { expect, test } from "bun:test";

// `bun test` na raiz é o runner do bun, não o script "test" do package.json.
// Este teste faz o runner cobrar o functions:check também.
test("domain-push.js está igual ao domínio (bun functions:build)", () => {
  const result = Bun.spawnSync(["bun", "run", "functions:check"], {
    cwd: `${import.meta.dir}/../../..`,
  });
  expect(result.stdout.toString()).not.toContain("desatualizado");
  expect(result.exitCode).toBe(0);
});
