import { env } from './env.js';
import type { GitHubCommit, GitHubPull, ProjectGitHub } from '../../client/src/lib/types.js';

/** "owner/name" from a github.com repository link, or null for anything else */
export function parseGitHubRepo(url: string | undefined | null) {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/^(www\.)?github\.com$/i.test(parsed.hostname)) return null;
  const [owner, name] = parsed.pathname.split('/').filter(Boolean);
  if (!owner || !name || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(name)) return null;
  return `${owner}/${name.replace(/\.git$/i, '')}`;
}

export class GitHubError extends Error {}

/** Links from the API are shown as-is, so only github.com pages are kept */
const githubPage = (url: string, fallback: string) => (url.startsWith('https://github.com/') ? url : fallback);

async function call<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${env.githubApiUrl}${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'HackTrack',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(env.githubToken ? { Authorization: `Bearer ${env.githubToken}` } : {}),
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new GitHubError('GitHub could not be reached. Try again in a minute.');
  }
  if (res.status === 404) throw new GitHubError('Repository not found. HackTrack can only read public repositories.');
  if (res.status === 403 || res.status === 429) {
    throw new GitHubError('GitHub is limiting requests right now. Try again later (the server owner can set GITHUB_TOKEN to raise the limit).');
  }
  if (!res.ok) throw new GitHubError(`GitHub answered with an error (${res.status}). Try again later.`);
  return (await res.json()) as T;
}

interface RawRepo {
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  pushed_at: string | null;
}
interface RawCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } | null };
  author: { login: string } | null;
}
interface RawPull {
  number: number;
  title: string;
  state: 'open' | 'closed';
  merged_at: string | null;
  updated_at: string;
  html_url: string;
  user: { login: string } | null;
}

/** Repository details, the latest commits on the default branch and the most recently updated pull requests */
export async function readRepository(repo: string): Promise<Pick<ProjectGitHub, 'info' | 'commits' | 'pulls'>> {
  const [info, commits, pulls] = await Promise.all([
    call<RawRepo>(`/repos/${repo}`),
    call<RawCommit[]>(`/repos/${repo}/commits?per_page=8`),
    call<RawPull[]>(`/repos/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=30`),
  ]);
  return {
    info: {
      description: info.description ?? '',
      defaultBranch: info.default_branch,
      stars: info.stargazers_count,
      forks: info.forks_count,
      openIssues: info.open_issues_count,
      language: info.language,
      pushedAt: info.pushed_at,
    },
    commits: commits.map(
      (c): GitHubCommit => ({
        sha: c.sha.slice(0, 7),
        message: c.commit.message.split('\n')[0].slice(0, 200),
        author: c.author?.login ?? c.commit.author?.name ?? 'unknown',
        date: c.commit.author?.date ?? '',
        url: githubPage(c.html_url, `https://github.com/${repo}/commit/${c.sha}`),
      })
    ),
    pulls: pulls.map(
      (p): GitHubPull => ({
        number: p.number,
        title: p.title.slice(0, 200),
        state: p.merged_at ? 'merged' : p.state,
        author: p.user?.login ?? 'unknown',
        updatedAt: p.updated_at,
        mergedAt: p.merged_at,
        url: githubPage(p.html_url, `https://github.com/${repo}/pull/${p.number}`),
      })
    ),
  };
}
