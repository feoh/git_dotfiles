declare module "@earendil-works/pi-coding-agent" {
  export interface ExtensionAPI {
    registerTool(config: {
      name: string;
      label: string;
      description: string;
      promptSnippet?: string;
      promptGuidelines?: string[];
      parameters: unknown;
      execute: (
        toolCallId: string,
        params: any,
        signal?: AbortSignal
      ) => Promise<{ content: Array<{ type: string; text: string }>; details: Record<string, unknown> }>;
    }): void;
    on(
      event: "session_start",
      handler: (
        event: unknown,
        ctx: { ui: { notify: (message: string, level?: string) => void } }
      ) => void | Promise<void>
    ): void;
  }
}

declare module "typebox" {
  export const Type: {
    Object(properties: Record<string, unknown>): unknown;
    Optional(schema: unknown): unknown;
    String(options?: Record<string, unknown>): unknown;
  };
}

declare const process: {
  env: Record<string, string | undefined>;
};
