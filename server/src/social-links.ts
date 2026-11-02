// Profile link platforms. The client keeps a matching list for labels and placeholders
// (client/src/lib/socialLinks.ts); this one decides what is accepted.

interface Platform {
  // Hosts a link may point to (subdomains allowed)
  hosts: string[];
  // Builds a link when someone types just their username
  fromUsername?: (name: string) => string;
}

export const PLATFORMS: Record<string, Platform> = {
  github: { hosts: ['github.com'], fromUsername: (n) => `https://github.com/${n}` },
  linkedin: { hosts: ['linkedin.com'], fromUsername: (n) => `https://www.linkedin.com/in/${n}` },
  leetcode: { hosts: ['leetcode.com'], fromUsername: (n) => `https://leetcode.com/u/${n}` },
  unstop: { hosts: ['unstop.com'], fromUsername: (n) => `https://unstop.com/u/${n}` },
  devpost: { hosts: ['devpost.com'], fromUsername: (n) => `https://devpost.com/${n}` },
  hackerrank: { hosts: ['hackerrank.com'], fromUsername: (n) => `https://www.hackerrank.com/profile/${n}` },
  codechef: { hosts: ['codechef.com'], fromUsername: (n) => `https://www.codechef.com/users/${n}` },
  codeforces: { hosts: ['codeforces.com'], fromUsername: (n) => `https://codeforces.com/profile/${n}` },
  kaggle: { hosts: ['kaggle.com'], fromUsername: (n) => `https://www.kaggle.com/${n}` },
  x: { hosts: ['x.com', 'twitter.com'], fromUsername: (n) => `https://x.com/${n}` },
  // A personal site or portfolio: any https address
  website: { hosts: [] },
};

const USERNAME = /^@?[A-Za-z0-9_.-]{1,60}$/;

/**
 * Turns what someone typed (a full link or just a username) into a clean https link for that platform.
 * Returns null for an empty value, or an error message if it is not a link to that site.
 */
export function normalizeLink(platform: string, raw: string): { url: string | null } | { error: string } {
  const spec = PLATFORMS[platform];
  if (!spec) return { error: `Unknown link type "${platform}".` };
  const value = raw.trim();
  if (!value) return { url: null };

  if (spec.fromUsername && USERNAME.test(value) && !value.includes('.')) {
    return { url: spec.fromUsername(value.replace(/^@/, '')) };
  }

  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return { error: `That doesn't look like a link.` };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: 'Links must start with https://' };
  url.protocol = 'https:';
  if (url.username || url.password) return { error: "Links can't contain a username or password." };

  const host = url.hostname.toLowerCase();
  if (spec.hosts.length && !spec.hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
    return { error: `This should be a ${spec.hosts[0]} link.` };
  }
  if (!spec.hosts.length && !host.includes('.')) return { error: "That doesn't look like a website address." };
  const clean = url.toString();
  return clean.length > 300 ? { error: 'That link is too long.' } : { url: clean };
}
