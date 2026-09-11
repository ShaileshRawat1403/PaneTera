// scripts/check-node-version.mjs
//
// Node 22 is PaneTera's authoritative development runtime: package.json
// engines, .nvmrc, and CI all name it. npm only warns about engines, and the
// test runner, tsx, and Vite do not check at all, so an older Node on PATH
// would otherwise run development, tests, lint, and builds silently.
//
// Kept to syntax every supported and unsupported Node can parse, so an old
// runtime reaches the message instead of a syntax error.

var REQUIRED_MAJOR = 22;
var version = process.versions.node;
var major = Number(version.split('.')[0]);

if (!(major >= REQUIRED_MAJOR)) {
  console.error(
    'PaneTera requires Node ' + REQUIRED_MAJOR + ' or newer, but this is Node ' + version + '.\n' +
    'Run `nvm use` in the repository root (see .nvmrc), then try again.'
  );
  process.exit(1);
}
