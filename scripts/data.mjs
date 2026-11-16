// Static content of the profile README. The showcase (projects in depth,
// full stack, experience) lives on the portfolio; this page is about how
// Jonathan works. Edit here, then run `npm run build`.

export const LOGIN = 'Jonathanrbt';
export const SITE = 'https://jonathanrbt.lat';

export const HERO = {
  name: 'Jonathan Romero',
  handle: 'JonathanRBT', // drawn in the banner
  role: 'Full Stack & AI-Integrations Developer',
  where: 'Bogotá · Remoto · Híbrido',
  line: 'Construyo agentes de IA y productos de punta a punta.',
};

// systemd-style boot lines printed before the banner.
export const BOOT = [
  'Reached target Hyprland (Omarchy).',
  'Started claude-code.service — pair programmer.',
  'Mounted /home/jonatin/walle — second brain.',
  'Listening on hyperswarm (JoJun).',
  'Started agents.target — LangGraph · RAG.',
];

// fastfetch-style system card: [key, value].
export const SYSTEM = {
  host: 'jonatin@cachyos',
  rows: [
    ['os', 'CachyOS (Arch Linux)'],
    ['wm', 'Hyprland · Omarchy'],
    ['shell', 'fish'],
    ['editor', 'LazyVim'],
    ['mux', 'Tmux · Zellij'],
    ['ai', 'Claude Code · Cursor · Herdr'],
    ['langs', 'TypeScript · Python · Go · Rust'],
    ['focus', 'agentes de IA · RAG · full stack'],
    ['uptime', '3 años construyendo'],
  ],
};

// Ship log, newest first, drawn as `git log --graph`.
export const SHIPS = [
  { name: 'Walle', what: 'mi second brain: Obsidian como memoria y grokbot como agente', stack: 'python · obsidian · grok', link: null, kind: 'privado' },
  { name: 'Gambito', what: 'asistente legal de IA que razona entre regímenes normativos', stack: 'ts · react · python', link: 'https://gambitoai.pages.dev/', kind: 'demo' },
  { name: 'JoJun', what: 'CLI P2P cifrada: pegas texto en una terminal y aparece en otra', stack: 'js · hyperswarm · bare', link: 'https://github.com/Organization-Jojun/jojun-cli', kind: 'repo' },
  { name: 'Platform Migratory', what: 'trámites migratorios con validación de documentos por IA', stack: 'ts · react · python', link: 'https://github.com/Jonathanrbt/platform-migratory-frontend', kind: 'repo' },
  { name: 'AdKio', what: 'agente que lanza campañas de Meta Ads desde lenguaje natural', stack: 'ts · react · python · postgres', tag: 'GTM Hackathon · top 2', link: 'https://web-production-9f9d1.up.railway.app/', kind: 'demo' },
  { name: 'Sniff', what: 'agente de code review que audita Pull Requests', stack: 'ts · react · tailwind', tag: 'Vercel Hackathon', link: 'https://sniff-plum.vercel.app/', kind: 'demo' },
];

export const FOOTER = ['El portafolio muestra lo que hice.'];
