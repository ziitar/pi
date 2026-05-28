import type { AgentMessage, AgentState } from "@earendil-works/pi-agent-core";
import type { ImageContent } from "@earendil-works/pi-ai";
import type {
	AgentConfig,
	AgentSessionFactory,
	AgentSessionHandle,
	AgentSessionOptions,
} from "@earendil-works/pi-multi-agent";
import type { AuthStorage } from "./auth-storage.ts";
import type { ModelRegistry } from "./model-registry.ts";
import { type CreateAgentSessionOptions, createAgentSession } from "./sdk.ts";
import type { SessionManager } from "./session-manager.ts";
import type { SettingsManager } from "./settings-manager.ts";

export interface CodingAgentSessionFactoryOptions {
	cwd?: string;
	agentDir?: string;
	authStorage?: AuthStorage;
	modelRegistry?: ModelRegistry;
	sessionManager?: SessionManager;
	settingsManager?: SettingsManager;
}

export class CodingAgentSessionFactory implements AgentSessionFactory {
	private readonly options: CodingAgentSessionFactoryOptions;

	constructor(options: CodingAgentSessionFactoryOptions = {}) {
		this.options = options;
	}

	async createSession(config: AgentConfig, options?: AgentSessionOptions): Promise<AgentSessionHandle> {
		const cwd = options?.cwd ?? this.options.cwd ?? process.cwd();
		const agentDir = this.options.agentDir;
		const authStorage = this.options.authStorage;
		const modelRegistry = this.options.modelRegistry;
		const sessionManager = this.options.sessionManager;
		const settingsManager = this.options.settingsManager;

		const sdkOptions: CreateAgentSessionOptions = {
			cwd,
			agentDir,
			authStorage,
			modelRegistry,
			sessionManager,
			settingsManager,
			model: config.model,
			thinkingLevel: config.thinkingLevel,
		};

		const result = await createAgentSession(sdkOptions);
		const session = result.session;

		const handle: AgentSessionHandle = {
			prompt: (input: string | AgentMessage | AgentMessage[], images?: ImageContent[]) => {
				if (typeof input === "string") {
					return session.prompt(input, { images });
				}
				return session.prompt(input as any);
			},
			abort: () => {
				session.abort();
			},
			getState: (): AgentState => session.agent.state,
			getSessionId: (): string => session.sessionManager.getSessionId(),
			subscribe: (listener) => session.agent.subscribe(listener),
			waitForIdle: (): Promise<void> => session.agent.waitForIdle(),
		};

		return handle;
	}
}
