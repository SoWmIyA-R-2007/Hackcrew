// Profile link platforms, in display order. The server (server/src/social-links.ts) keeps the matching
// list that decides which links are accepted; keep the ids in sync.
export const SOCIAL_PLATFORMS: { id: string; label: string; placeholder: string }[] = [
  { id: 'github', label: 'GitHub', placeholder: 'username or github.com/…' },
  { id: 'linkedin', label: 'LinkedIn', placeholder: 'username or linkedin.com/in/…' },
  { id: 'leetcode', label: 'LeetCode', placeholder: 'username or leetcode.com/u/…' },
  { id: 'unstop', label: 'Unstop', placeholder: 'username or unstop.com/u/…' },
  { id: 'devpost', label: 'Devpost', placeholder: 'username or devpost.com/…' },
  { id: 'hackerrank', label: 'HackerRank', placeholder: 'username or hackerrank.com/profile/…' },
  { id: 'codechef', label: 'CodeChef', placeholder: 'username or codechef.com/users/…' },
  { id: 'codeforces', label: 'Codeforces', placeholder: 'username or codeforces.com/profile/…' },
  { id: 'kaggle', label: 'Kaggle', placeholder: 'username or kaggle.com/…' },
  { id: 'x', label: 'X (Twitter)', placeholder: 'username or x.com/…' },
  { id: 'website', label: 'Website', placeholder: 'https://your-portfolio.dev' },
];

export const platformLabel = (id: string) => SOCIAL_PLATFORMS.find((p) => p.id === id)?.label ?? id;
