import type { AgentRequest, AgentResponse } from "./protocol.ts";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

export function serializeRequest(request: AgentRequest): string {
	return JSON.stringify(request);
}

export function deserializeRequest(data: string): AgentRequest {
	const parsed = JSON.parse(data);
	assertValidRequest(parsed);
	return parsed;
}

export function serializeResponse(response: AgentResponse): string {
	return JSON.stringify(response);
}

export function deserializeResponse(data: string): AgentResponse {
	const parsed = JSON.parse(data);
	assertValidResponse(parsed);
	return parsed;
}

export function encodeRequest(request: AgentRequest): Uint8Array {
	return ENCODER.encode(serializeRequest(request));
}

export function decodeRequest(data: Uint8Array): AgentRequest {
	return deserializeRequest(DECODER.decode(data));
}

export function encodeResponse(response: AgentResponse): Uint8Array {
	return ENCODER.encode(serializeResponse(response));
}

export function decodeResponse(data: Uint8Array): AgentResponse {
	return deserializeResponse(DECODER.decode(data));
}

function assertValidRequest(value: unknown): asserts value is AgentRequest {
	if (typeof value !== "object" || value === null) {
		throw new Error("Invalid request: not an object");
	}
	const req = value as Record<string, unknown>;
	if (typeof req.from !== "string") {
		throw new Error("Invalid request: 'from' must be a string");
	}
	if (typeof req.task !== "string") {
		throw new Error("Invalid request: 'task' must be a string");
	}
	if (req.mode !== "sync" && req.mode !== "async") {
		throw new Error("Invalid request: 'mode' must be 'sync' or 'async'");
	}
}

function assertValidResponse(value: unknown): asserts value is AgentResponse {
	if (typeof value !== "object" || value === null) {
		throw new Error("Invalid response: not an object");
	}
	const res = value as Record<string, unknown>;
	if (typeof res.from !== "string") {
		throw new Error("Invalid response: 'from' must be a string");
	}
	if (res.status !== "success" && res.status !== "error" && res.status !== "timeout") {
		throw new Error("Invalid response: 'status' must be 'success', 'error', or 'timeout'");
	}
}
