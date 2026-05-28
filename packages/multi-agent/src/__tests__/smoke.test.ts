import { describe, expect, it } from "vitest";

describe("@earendil-works/pi-multi-agent", () => {
	it("should be resolvable", () => {
		expect(() => {}).not.toThrow();
	});

	it("has a package name", () => {
		const pkg = require("../../package.json");
		expect(pkg.name).toBe("@earendil-works/pi-multi-agent");
	});

	it("exports an object", async () => {
		const mod = await import("../index.ts");
		expect(mod).toBeDefined();
	});
});
