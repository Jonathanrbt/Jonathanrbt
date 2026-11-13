// Profile content, mirrored from the portfolio (jonathanrbt.lat):
// src/i18n/translations.ts (es) and src/data/index.ts.
// Update it here when the portfolio changes, then run `npm run build`.

export const SITE = 'https://jonathanrbt.lat';
export const PORTFOLIO_REPO = '../..'; // portfolio root, for screenshots and logos

export const PROFILE = {
  name: 'Jonathan Romero',
  role: 'Full Stack & AI-Integrations Developer',
  heroTitle: ['Software', 'Developer'],
  location: 'Bogotá, Colombia',
  status: 'Disponible para nuevas oportunidades',
  modality: 'Remoto · Híbrido · Bogotá, Colombia',
  heroLine: { pre: 'Vivo en ', em: 'el momento anterior', post: ' a que las cosas existan.' },
  expertise: ['AI-Integrations', 'LLMs & Agentes', 'Full Stack'],
  roles: ['Full Stack Developer', 'AI Engineer', 'AI-Integrations Developer'],
  reasons: [
    'Construyo de punta a punta — de la idea y el diseño hasta el producto corriendo en producción.',
    'Trabajo con IA: LLMs, agentes y RAG resolviendo problemas de negocio, no demos de laboratorio.',
    'Lidero con el ejemplo — coordiné un equipo de 4 sin soltar nunca el código.',
    'Entrego bajo presión: 3 hackathones, 3 reconocimientos del jurado.',
  ],
  email: 'jonathanstiwarromerobetancourt@gmail.com',
  linkedin: 'https://www.linkedin.com/in/jonathan-romero-b2044a303',
};

export const ABOUT = {
  label: 'Sobre mí',
  paragraphs: [
    'Hay un punto en que una idea deja de ser solo pensamiento y empieza a ocupar lugar en el mundo. Ese tránsito —de lo posible a lo real— es quizá lo más cercano que existe a la magia.',
    'No siempre vi el mundo así. Crecí creyendo en límites que ni siquiera eran míos, y soltarlos me tomó tiempo. Pero esa decisión lo cambió todo: entendí que crear algo y transformarme eran el mismo gesto. Y si lo que construyo le ahorra a alguien parte del camino que a mí me tocó andar a ciegas, entonces valió la pena.',
  ],
  stats: [
    { value: '3', label: 'Años de Exp.' },
    { value: '5', label: 'Proyectos lanzados' },
    { value: '3', label: 'Hackathones' },
  ],
};

export const VISION = {
  label: 'Visión',
  line1: 'Ante la inmensidad del tiempo, lo trivial no merece ni un instante del mío.',
  line2: 'Que cada uno arda en algo que valga la pena recordar.',
};

export const CTA = ['¿Tienes una idea', 'que aún no existe?'];

export const PROJECTS = [
  {
    slug: 'adkio',
    image: 'public/adkio.jpeg',
    imagePosition: 'top',
    link: 'https://web-production-9f9d1.up.railway.app/',
    category: '01 / Marketing IA · GTM Hackathon · top 2',
    title: 'AdKio',
    description:
      'Agente de IA que ejecuta campañas en Meta Ads desde lenguaje natural. Codifica conocimiento experto (audiencia, copy, presupuesto) y lo configura con razonamiento transparente paso a paso, lanzando con aprobación humana.',
    tech: ['TypeScript', 'React', 'Python', 'PostgreSQL'],
  },
  {
    slug: 'gambito',
    image: 'public/gambito.jpeg',
    link: 'https://gambitoai.pages.dev/',
    category: '02 / LegalTech IA',
    title: 'Gambito',
    description:
      'Asistente legal de IA que analiza expedientes y genera documentos jurídicos con razonamiento multirégimen, adaptando su criterio al marco normativo aplicable. Integra autenticación, gestión de usuarios y un cerebro conversacional.',
    tech: ['TypeScript', 'React', 'Python', 'SQL', 'Docker'],
  },
  {
    slug: 'sniff',
    image: 'public/sniff.jpeg',
    link: 'https://sniff-plum.vercel.app/',
    category: '03 / DevTools IA · Vercel Hackathon',
    title: 'Sniff',
    description:
      'Agente de IA para code review: analiza Pull Requests de GitHub, evalúa la calidad del código y detecta vulnerabilidades, emitiendo recomendaciones para el merge. Reconocido en el Vercel Hackathon.',
    tech: ['React', 'TypeScript', 'Tailwind'],
  },
  {
    slug: 'platform-migratory',
    image: 'public/PlatformMigratory.jpeg',
    link: 'https://platform-migratory-frontend.pages.dev/',
    category: '04 / LegalTech IA',
    title: 'Platform Migratory',
    description:
      'Plataforma que agiliza trámites migratorios con validación de documentos por IA. Gestiona clientes y abogados, guarda archivos en Drive y sincroniza el estado del expediente en Sheets.',
    tech: ['TypeScript', 'React', 'Python'],
  },
  {
    slug: 'jojun',
    image: 'public/Jojun.jpeg',
    link: 'https://jojun-cli.jonathanrbt.lat/',
    category: '05 / CLI P2P',
    title: 'JoJun',
    description:
      'CLI que conecta dos computadores en una sala compartida cifrada: pegas un texto en una terminal y aparece en la otra, sin nube, intermediarios, ni servidor propio. Usa Hyperswarm peer-to-peer, instalador multiplataforma y sesión interactiva en la terminal.',
    tech: ['JavaScript', 'Hyperswarm', 'Bare'],
  },
];

export const EXPERIENCE = [
  {
    year: 'Jul — Dic 2025',
    role: 'Full Stack Developer & AI Lead',
    company: 'Solvo Global',
    desc: 'Lideré técnicamente un equipo fullstack de 4 personas bajo metodologías ágiles. Diseñé e implementé un bot conversacional de ventas orquestado con LangChain, LangGraph y Qdrant (RAG), anclando las respuestas del modelo al catálogo y eliminando las alucinaciones. Desarrollé end-to-end una plataforma de generación de exámenes basada en LLMs con React, Node/Express y MySQL.',
  },
  {
    year: '2025',
    role: 'Desarrollo de Software',
    company: 'Universidad EAN',
    desc: 'Formación profesional en desarrollo de software, en un programa acreditado en alta calidad. Aquí construí las bases de arquitectura, lógica y buenas prácticas que hoy aplico cuando llevo una idea hasta convertirla en producto real.',
  },
  {
    year: '2024',
    role: 'Bootcamp Java Profesional',
    company: 'Código Facilito',
    desc: 'Programa intensivo enfocado en el desarrollo de aplicaciones: fundamentos sólidos de programación orientada a objetos, backend y resolución de problemas bajo presión.',
  },
];

// Same reels as the portfolio's ReelGallery. `icon` is a devicon path, or a
// file under the portfolio's public/ folder when it starts with '/'.
export const TECH_REELS = [
  [
    { name: 'Python', icon: 'python/python-original.svg' },
    { name: 'TypeScript', icon: 'typescript/typescript-original.svg' },
    { name: 'JavaScript', icon: 'javascript/javascript-original.svg' },
    { name: 'Java', icon: 'java/java-original.svg' },
    { name: 'Go', icon: '/tech/go.svg' },
    { name: 'Rust', icon: '/tech/rust.svg' },
    { name: 'React', icon: 'react/react-original.svg' },
    { name: 'Next.js', icon: 'nextjs/nextjs-original.svg', invert: true },
    { name: 'React Native', icon: '/tech/reactnative.svg' },
    { name: 'Expo', icon: '/tech/expo.svg' },
    { name: 'Astro', icon: '/tech/astro.svg' },
    { name: 'Tailwind CSS', icon: 'tailwindcss/tailwindcss-original.svg' },
    { name: 'Vite', icon: 'vitejs/vitejs-original.svg' },
  ],
  [
    { name: 'Node.js', icon: 'nodejs/nodejs-original.svg' },
    { name: 'Express', icon: '/tech/express.svg' },
    { name: 'FastAPI', icon: 'fastapi/fastapi-original.svg' },
    { name: 'MySQL', icon: 'mysql/mysql-original.svg' },
    { name: 'PostgreSQL', icon: 'postgresql/postgresql-original.svg' },
    { name: 'Qdrant', icon: '/tech/qdrant.svg' },
    { name: 'MongoDB', icon: 'mongodb/mongodb-original.svg' },
    { name: 'Redis', icon: 'redis/redis-original.svg' },
    { name: 'Supabase', icon: 'supabase/supabase-original.svg' },
  ],
  [
    { name: 'LangChain', icon: '/tech/langchain.svg' },
    { name: 'LangGraph', icon: '/tech/langgraph.svg' },
    { name: 'RAG', icon: '/tech/rag.svg' },
    { name: 'Cursor', icon: '/tech/cursor.svg' },
    { name: 'Claude Code', icon: '/tech/claude.svg' },
    { name: 'Herdr', icon: '/tech/herdr.png' },
  ],
  [
    { name: 'Git', icon: 'git/git-original.svg' },
    { name: 'GitHub', icon: '/tech/github.svg' },
    { name: 'Docker', icon: 'docker/docker-original.svg' },
    { name: 'Google Cloud', icon: 'googlecloud/googlecloud-original.svg' },
    { name: 'AWS', icon: '/tech/aws.svg' },
    { name: 'Cloudflare', icon: '/tech/cloudflare.svg' },
    { name: 'Scrum', icon: '/tech/scrum.svg' },
  ],
];
