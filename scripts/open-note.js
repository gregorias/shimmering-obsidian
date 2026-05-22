#!/usr/bin/env osascript -l JavaScript
ObjC.import("stdlib");
const app = Application.currentApplication();
app.includeStandardAdditions = true;
//──────────────────────────────────────────────────────────────────────────────

const fileExists = (/** @type {string} */ filePath) => Application("Finder").exists(Path(filePath));

/** @param {string} path */
function readFile(path) {
	const data = $.NSFileManager.defaultManager.contentsAtPath(path);
	const str = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding);
	return ObjC.unwrap(str);
}

/** @param {string} relativePath */
function parseRelativePath(relativePath) {
	const filePath = (relativePath.split("#")[0] || "").split(":")[0] || "";
	const heading = relativePath.split("#")[1];
	const lineNum = relativePath.split(":")[1]; // used by `oe` external link search to open at line
	return { filePath, heading, lineNum };
}

/**
 * @param {string} vaultNameEnc
 * @param {string} filePath
 * @param {string|undefined} heading
 * @param {string|undefined} lineNum
 * @param {string|undefined} openMode
 */
function constructOpenNoteUri(vaultNameEnc, filePath, heading, lineNum, openMode) {
	// https://help.obsidian.md/Extending+Obsidian/Obsidian+URI
	// https://vinzent03.github.io/obsidian-advanced-uri/actions/navigation
	const urlComponents = [
		"obsidian://advanced-uri?",
		`vault=${vaultNameEnc}`,
		`&filepath=${encodeURIComponent(filePath)}`,
		heading ? "&heading=" + encodeURIComponent(heading) : "",
		lineNum ? "&line=" + encodeURIComponent(lineNum) : "",
		openMode ? "&openmode=" + openMode : "",
	];
	return urlComponents.join("");
}

/**
 * @param {string} vaultPath
 * @param {string} configFolder
 * @returns {boolean} whether `Advanced URI` plugin is installed and enabled
 */
function isAdvancedUriEnabled(vaultPath, configFolder) {
	const aUriInstalled = fileExists(`${vaultPath}/${configFolder}/plugins/obsidian-advanced-uri`);
	const pluginList = readFile(`${vaultPath}/${configFolder}/community-plugins.json`);
	const aUriEnabled = JSON.parse(pluginList).includes("obsidian-advanced-uri");
	return aUriInstalled && aUriEnabled;
}

//──────────────────────────────────────────────────────────────────────────────

/** @type {AlfredRun} */
// biome-ignore lint/correctness/noUnusedVariables: Alfred run
function run(argv) {
	const vaultPath = $.getenv("vault_path");
	const vaultNameEnc = encodeURIComponent(vaultPath.replace(/.*\//, ""));

	// VALIDATE that `Advanced URI` is installed and enabled.
	if (!isAdvancedUriEnabled(vaultPath, $.getenv("config_folder"))) {
		return '"Advanced URI" plugin not installed or not enabled.';
	}

	// determine input; trim to remove trailing \n
	const smartRelativePath = parseRelativePath((argv[0] || "").trim());

	// DOCS https://vinzent03.github.io/obsidian-advanced-uri/concepts/navigation_parameters#open-mode
	const openMode = $.NSProcessInfo.processInfo.environment.objectForKey("open_mode").js;

	const openNoteUri = constructOpenNoteUri(
		vaultNameEnc,
		smartRelativePath.filePath,
		smartRelativePath.heading,
		smartRelativePath.lineNum,
		openMode,
	);

	// OPEN FILE
	// - Delay opening URI scheme until Obsidian is running, URIs do not open
	//   reliably when vault is not open. (also applies to Obsidian core's URIs)
	// - Do not count windows, since it requires somewhat the macOS accessibility
	//   perrmission, which often appears to be bit buggy (see #191).
	if (!Application("Obsidian").running()) {
		Application("Obsidian").launch();
		delay(1.5);
	}
	app.openLocation(openNoteUri);
	console.log("URI opened:", openNoteUri);
	return;
}
