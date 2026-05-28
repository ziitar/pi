import { describe, expect, it } from "vitest";
import type { AgentRequest, AgentResponse } from "../protocol.ts";
import {
	decodeRequest,
	decodeResponse,
	deserializeRequest,
	deserializeResponse,
	encodeRequest,
	encodeResponse,
	serializeRequest,
	serializeResponse,
} from "../serializer.ts";

describe("protocol", () => {
	describe("AgentRequest serialization round-trip", () => {
		it("round-trips a minimal sync request", () => {
			const request: AgentRequest = {
				from: "agent-a",
				task: "do something",
				mode: "sync",
			};

			const json = serializeRequest(request);
			const decoded = deserializeRequest(json);

			expect(decoded).toEqual(request);
		});

		it("round-trips a request with all optional fields", () => {
			const request: AgentRequest = {
				from: "agent-b",
				task: "complex task",
				mode: "async",
				stepId: "step-1",
				dependencies: ["step-0"],
				context: { key: "value", nested: { a: 1 } },
			};

			const json = serializeRequest(request);
			const decoded = deserializeRequest(json);

			expect(decoded).toEqual(request);
		});

		it("round-trips via binary encode/decode", () => {
			const request: AgentRequest = {
				from: "agent-c",
				task: "binary test",
				mode: "sync",
				stepId: "step-2",
			};

			const bytes = encodeRequest(request);
			const decoded = decodeRequest(bytes);

			expect(decoded).toEqual(request);
		});
	});

	describe("AgentResponse serialization round-trip", () => {
		it("round-trips a success response", () => {
			const response: AgentResponse = {
				from: "agent-b",
				stepId: "step-1",
				status: "success",
				result: "done",
			};

			const json = serializeResponse(response);
			const decoded = deserializeResponse(json);

			expect(decoded).toEqual(response);
		});

		it("round-trips an error response", () => {
			const response: AgentResponse = {
				from: "agent-b",
				status: "error",
				error: "something went wrong",
			};

			const json = serializeResponse(response);
			const decoded = deserializeResponse(json);

			expect(decoded).toEqual(response);
		});

		it("round-trips a response with artifacts", () => {
			const response: AgentResponse = {
				from: "agent-b",
				stepId: "step-3",
				status: "success",
				result: "generated code",
				artifacts: [
					{ type: "file", content: "console.log('hello')" },
					{ type: "data", content: '{"key":"value"}', metadata: { format: "json" } },
				],
			};

			const json = serializeResponse(response);
			const decoded = deserializeResponse(json);

			expect(decoded).toEqual(response);
		});

		it("round-trips via binary encode/decode", () => {
			const response: AgentResponse = {
				from: "agent-d",
				status: "timeout",
				error: "timed out",
			};

			const bytes = encodeResponse(response);
			const decoded = decodeResponse(bytes);

			expect(decoded).toEqual(response);
		});
	});

	describe("validation", () => {
		it("rejects request with missing 'from'", () => {
			const bad = JSON.stringify({ task: "x", mode: "sync" });
			expect(() => deserializeRequest(bad)).toThrow("'from' must be a string");
		});

		it("rejects request with missing 'task'", () => {
			const bad = JSON.stringify({ from: "a", mode: "sync" });
			expect(() => deserializeRequest(bad)).toThrow("'task' must be a string");
		});

		it("rejects request with invalid 'mode'", () => {
			const bad = JSON.stringify({ from: "a", task: "x", mode: "invalid" });
			expect(() => deserializeRequest(bad)).toThrow("'mode' must be 'sync' or 'async'");
		});

		it("rejects response with missing 'from'", () => {
			const bad = JSON.stringify({ status: "success" });
			expect(() => deserializeResponse(bad)).toThrow("'from' must be a string");
		});

		it("rejects response with invalid 'status'", () => {
			const bad = JSON.stringify({ from: "a", status: "pending" });
			expect(() => deserializeResponse(bad)).toThrow("'status' must be 'success', 'error', or 'timeout'");
		});

		it("rejects non-object input for request", () => {
			expect(() => deserializeRequest('"hello"')).toThrow("not an object");
		});

		it("rejects non-object input for response", () => {
			expect(() => deserializeResponse("null")).toThrow("not an object");
		});
	});
});
