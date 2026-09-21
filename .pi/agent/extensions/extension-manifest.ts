import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MANIFEST_PATH = join(homedir(), ".config", "pi", "packages.txt");
const AGENT_DIR =
	process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
const SETTINGS_PATH = join(AGENT_DIR, "settings.json");

function manifestPackages(contents: string): string[] {
	return contents
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("#"));
}

function configuredPackages(contents: string): string[] {
	const settings = JSON.parse(contents) as {
		packages?: Array<string | { source?: unknown }>;
	};

	return (settings.packages ?? []).map((entry) => {
		if (typeof entry === "string") return entry;
		if (typeof entry.source === "string") return entry.source;
		throw new Error("settings.json contains a package without a string source");
	});
}

function uniqueSorted(values: string[]): string[] {
	return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function difference(left: string[], right: string[]): string[] {
	const rightSet = new Set(right);
	return uniqueSorted(left).filter((value) => !rightSet.has(value));
}

function formatDiff(missing: string[], unlisted: string[]): string {
	if (missing.length === 0 && unlisted.length === 0) {
		return "Configured Pi packages match ~/.config/pi/packages.txt";
	}

	const sections: string[] = [];
	if (missing.length > 0) {
		sections.push(`Missing locally:\n${missing.map((item) => `  + ${item}`).join("\n")}`);
	}
	if (unlisted.length > 0) {
		sections.push(
			`Not in manifest:\n${unlisted.map((item) => `  - ${item}`).join("\n")}`,
		);
	}
	return sections.join("\n\n");
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("extensions-diff", {
		description: "Compare configured Pi packages with ~/.config/pi/packages.txt",
		handler: async (_args, ctx) => {
			try {
				const [manifest, settings] = await Promise.all([
					readFile(MANIFEST_PATH, "utf8"),
					readFile(SETTINGS_PATH, "utf8"),
				]);
				const wanted = manifestPackages(manifest);
				const configured = configuredPackages(settings);
				const missing = difference(wanted, configured);
				const unlisted = difference(configured, wanted);

				ctx.ui.notify(
					formatDiff(missing, unlisted),
					missing.length === 0 && unlisted.length === 0 ? "info" : "warning",
				);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`Unable to compare extension manifest: ${message}`, "error");
			}
		},
	});
}
