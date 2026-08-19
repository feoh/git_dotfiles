import assert from "node:assert/strict";
import test from "node:test";
import {
	commandCandidatePaths,
	commandChangesSopsMetadata,
	commandFormatsSopsSecret,
	commandMayMutateFiles,
	commandPassesSopsValueInArguments,
	commandUsesSops,
	encodeSopsValue,
	hasSopsMetadata,
	isKnownSopsPath,
	isSafeSopsPathExpression,
	stableSopsMetadata,
} from "./sops-guard-core.ts";

const cwd = "/work/ol-infrastructure";

test("recognizes conventional and repository SOPS paths", () => {
	assert.equal(
		isKnownSopsPath("src/bridge/secrets/app/data.production.yaml", cwd),
		true,
	);
	assert.equal(isKnownSopsPath("config/service.sops.json", cwd), true);
	assert.equal(isKnownSopsPath("config/plain.yaml", cwd), false);
});

test("recognizes SOPS metadata in supported text formats", () => {
	assert.equal(
		hasSopsMetadata("value: ENC[...]\nsops:\n  version: 3.9.0\n"),
		true,
	);
	assert.equal(
		hasSopsMetadata('{"value":"ENC[...]","sops":{"version":"3.9.0"}}'),
		true,
	);
	assert.equal(hasSopsMetadata("[sops]\nversion=3.9.0\n"), true);
	assert.equal(hasSopsMetadata("sops_version=3.9.0\n"), true);
	assert.equal(hasSopsMetadata("ordinary: yaml\n"), false);
});

test("resolves a relative filename after a shell cd", () => {
	const paths = commandCandidatePaths(
		"cd src/bridge/secrets/app && sops set --value-stdin data.production.yaml '[\"api_key\"]'",
		cwd,
	);
	assert.ok(
		paths.includes(
			"/work/ol-infrastructure/src/bridge/secrets/app/data.production.yaml",
		),
	);
});

test("recognizes wrapper paths as SOPS commands", () => {
	assert.equal(
		commandUsesSops("src/bridge/secrets/bin/sops -d data.production.yaml"),
		true,
	);
	assert.equal(commandUsesSops("git diff -- data.production.yaml"), false);
});

test("detects unsafe literal set values but accepts stdin and files", () => {
	assert.equal(
		commandPassesSopsValueInArguments(
			"sops set file.yaml '[\"key\"]' '\"secret\"'",
		),
		true,
	);
	assert.equal(
		commandPassesSopsValueInArguments(
			"src/bridge/secrets/bin/sops set file.yaml '[\"key\"]' '\"secret\"'",
		),
		true,
	);
	assert.equal(
		commandPassesSopsValueInArguments(
			"sops set --value-stdin file.yaml '[\"key\"]'",
		),
		false,
	);
	assert.equal(
		commandPassesSopsValueInArguments(
			"sops set --value-file file.yaml '[\"key\"]' /tmp/value",
		),
		false,
	);
});

test("detects metadata changes through a SOPS wrapper path", () => {
	assert.equal(
		commandChangesSopsMetadata(
			"src/bridge/secrets/bin/sops rotate data.production.yaml",
		),
		true,
	);
	assert.equal(
		commandChangesSopsMetadata(
			"src/bridge/secrets/bin/sops decrypt data.production.yaml",
		),
		false,
	);
});

test("detects common non-SOPS file mutation commands", () => {
	assert.equal(
		commandMayMutateFiles("sed -i s/old/new/ data.production.yaml"),
		true,
	);
	assert.equal(commandMayMutateFiles("cat data.production.yaml"), false);
	assert.equal(
		commandMayMutateFiles("cat data.production.yaml > /tmp/plaintext"),
		true,
	);
});

test("requires yamlfmt to be skipped for broad infrastructure pre-commit runs", () => {
	assert.equal(
		commandFormatsSopsSecret("pre-commit run --all-files", false, true),
		true,
	);
	assert.equal(
		commandFormatsSopsSecret(
			"SKIP=yamlfmt pre-commit run --all-files",
			false,
			true,
		),
		false,
	);
});

test("accepts only bracket-form SOPS key paths", () => {
	assert.equal(isSafeSopsPathExpression('["service"]["api_key"]'), true);
	assert.equal(isSafeSopsPathExpression('["items"][0]'), true);
	assert.equal(isSafeSopsPathExpression("service.api_key"), false);
	assert.equal(isSafeSopsPathExpression('["key"]\n--output /tmp/leak'), false);
});

test("metadata fingerprint ignores only MAC and lastmodified", () => {
	const before =
		"data: ENC[...]\nsops:\n  kms:\n    - arn: one\n  lastmodified: old\n  mac: old\n  version: 3.9.0\n";
	const expectedUpdate =
		"data: ENC[...]\nsops:\n  kms:\n    - arn: one\n  lastmodified: new\n  mac: new\n  version: 3.9.0\n";
	const recipientChange =
		"data: ENC[...]\nsops:\n  kms:\n    - arn: two\n  lastmodified: new\n  mac: new\n  version: 3.9.0\n";
	assert.equal(stableSopsMetadata(before), stableSopsMetadata(expectedUpdate));
	assert.notEqual(
		stableSopsMetadata(before),
		stableSopsMetadata(recipientChange),
	);
});

test("encodes string values and validates structured JSON", () => {
	assert.equal(
		encodeSopsValue("line one\nline two", "string"),
		'"line one\\nline two"',
	);
	assert.equal(encodeSopsValue('{"enabled":true}', "json"), '{"enabled":true}');
	assert.throws(
		() => encodeSopsValue("not json", "json"),
		/SOPS JSON source is invalid/,
	);
});
