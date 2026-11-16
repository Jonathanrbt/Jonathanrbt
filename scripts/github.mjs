// Live data for the "ahora mismo" and contribution-map sections, from the GitHub
// GraphQL API. Only public repositories are read; the contribution calendar is
// the same one shown on the public profile.
//
// Token: GITHUB_TOKEN (set by the Actions workflow), or the local `gh` login.

import { execFileSync } from 'node:child_process';

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const QUERY = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
    repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false,
                 orderBy: { field: PUSHED_AT, direction: DESC }) {
      nodes {
        name
        pushedAt
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } }
        defaultBranchRef { target { ... on Commit { history(first: 10) { nodes { messageHeadline committedDate } } } } }
      }
    }
  }
}`;

const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

export async function fetchActivity(login) {
  const t = token();
  if (!t) return null;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${t}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-readme-builder' },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`GitHub GraphQL: ${JSON.stringify(json.errors ?? res.status)}`);
  const user = json.data.user;

  const cal = user.contributionsCollection.contributionCalendar;
  const weeks = cal.weeks.map((w) =>
    w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, level: LEVEL[d.contributionLevel] ?? 0 })));
  const days = weeks.flat();

  // Streaks: today with no commits yet does not break the current streak.
  let longest = 0;
  let run = 0;
  for (const d of days) { run = d.count ? run + 1 : 0; longest = Math.max(longest, run); }
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count) current++;
    else if (i === days.length - 1) continue;
    else break;
  }

  // The profile repo itself is skipped: its daily refresh would always win.
  const repos = user.repositories.nodes.filter((r) => r.name.toLowerCase() !== login.toLowerCase());
  const latest = repos.find((r) => r.defaultBranchRef);
  // Merge commits say little about the work itself; show the latest real one.
  const history = latest?.defaultBranchRef.target.history.nodes ?? [];
  const commit = history.find((c) => !/^Merge (pull request|branch)/.test(c.messageHeadline)) ?? history[0];

  const yearAgo = Date.now() - 365 * 864e5;
  const sizes = new Map();
  for (const r of repos.filter((x) => Date.parse(x.pushedAt) > yearAgo)) {
    for (const e of r.languages.edges) sizes.set(e.node.name, (sizes.get(e.node.name) ?? 0) + e.size);
  }
  const total = [...sizes.values()].reduce((a, b) => a + b, 0) || 1;
  const languages = [...sizes].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, size]) => ({ name, pct: size / total }));

  return {
    total: cal.totalContributions,
    weeks,
    streak: { current, longest },
    latest: latest && commit ? { repo: latest.name, message: commit.messageHeadline, date: commit.committedDate } : null,
    languages,
  };
}
