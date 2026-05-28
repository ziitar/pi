import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClassificationRouter } from "../classification-router.ts";

vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
}));

vi.mock("@earendil-works/pi-multi-agent", () => ({
	parseAgentIndex: vi.fn(),
}));

describe("classification-router", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("createClassificationRouter", () => {
		it("returns single-agent mode when no agents-index.md exists", async () => {
			const { existsSync } = await import("node:fs");
			vi.mocked(existsSync).mockReturnValue(false);

			const router = createClassificationRouter("/test/agents");

			expect(router.isMultiAgent).toBe(false);
			expect(router.agentPool).toBeNull();
		});

		it("returns single-agent mode when agents-index.md has no version marker", async () => {
			const { existsSync, readFileSync } = await import("node:fs");
			const { parseAgentIndex } = await import("@earendil-works/pi-multi-agent");

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readFileSync).mockReturnValue("some content");
			vi.mocked(parseAgentIndex).mockReturnValue(null);

			const router = createClassificationRouter("/test/agents");

			expect(router.isMultiAgent).toBe(false);
			expect(router.agentPool).toBeNull();
		});

		it("returns multi-agent mode when agents-index.md has valid version marker", async () => {
			const { existsSync, readFileSync } = await import("node:fs");
			const { parseAgentIndex } = await import("@earendil-works/pi-multi-agent");

			const mockPool = {
				version: 1,
				agents: [
					{
						name: "test-agent",
						categories: ["coding"],
						model: "anthropic/claude-sonnet-4-20250514",
						status: "active" as const,
					},
				],
			};

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readFileSync).mockReturnValue("version: 1\n...");
			vi.mocked(parseAgentIndex).mockReturnValue(mockPool);

			const router = createClassificationRouter("/test/agents");

			expect(router.isMultiAgent).toBe(true);
			expect(router.agentPool).toEqual(mockPool);
		});

		it("returns single-agent mode when version is 0", async () => {
			const { existsSync, readFileSync } = await import("node:fs");
			const { parseAgentIndex } = await import("@earendil-works/pi-multi-agent");

			const mockPool = {
				version: 0,
				agents: [],
			};

			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readFileSync).mockReturnValue("version: 0\n...");
			vi.mocked(parseAgentIndex).mockReturnValue(mockPool);

			const router = createClassificationRouter("/test/agents");

			expect(router.isMultiAgent).toBe(false);
			expect(router.agentPool).toEqual(mockPool);
		});
	});

	describe("classifyAndRoute", () => {
		it("returns null when no routing available (single-agent, no config)", async () => {
			const { existsSync } = await import("node:fs");
			vi.mocked(existsSync).mockReturnValue(false);

			const router = createClassificationRouter("/test/agents");
			const result = await router.classifyAndRoute("test input");

			expect(result).toBeNull();
		});
	});
});
