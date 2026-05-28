const MODES = new Set(['narration', 'podcast', 'both']);

export function parseArgs(argv) {
  const a = { mode: 'both', dryRun: false, article: null };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--article') a.article = argv[++i];
    else if (t === '--mode') a.mode = argv[++i];
    else if (t === '--dry-run') a.dryRun = true;
    else throw new Error(`Unknown argument: ${t}`);
  }
  if (!a.article) throw new Error('Missing required --article <slug|all>');
  if (!MODES.has(a.mode)) throw new Error(`Invalid --mode: ${a.mode} (narration|podcast|both)`);
  return a;
}
