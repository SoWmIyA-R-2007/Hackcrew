# HackTrack

Keep every hackathon you have registered for in one place. HackTrack puts all your submission deadlines on one timeline, keeps each problem statement next to its task list, and tracks who on the team owns what.

## Features

- **Schedule timeline**: every hackathon as a bar from kickoff to submission deadline, filled to its task progress, with a marker for today and diamonds for registration, shortlist and final presentation dates. Hackathons that passed their deadline without a submission are outlined in red.
- **Hackathon list**: sorted so unfinished work and the nearest deadline come first, with search and filters (in progress, overdue, submitted or done, high priority).
- **Hackathon page**: time used against tasks done, problem statement, tasks, submission checklist, result, key dates, team and reminders. Status can be changed in one click; every other detail is editable.
- **Teams**: invite teammates by email. Once they accept they can see and edit the hackathon too; only the person who added it can delete it or manage the team. If two people edit at the same moment, the second save is refused and the latest version is loaded, so nobody's work is silently overwritten.
- **Tasks**: assign each task to someone on the team and give it a due date. **My tasks** lists everything assigned to you across all hackathons and projects, grouped by when it is due.
- **Project tracker**: track what you are building, for a hackathon or on your own, on a board with Backlog, To do, In progress, In review and Done columns. Cards have a priority, an assignee, a due date and a milestone; milestones show how many of their cards are done; an activity log records every change. Invite friends, teammates or anyone by username to collaborate. See [Projects](#projects).
- **GitHub link**: a project whose code link is a public GitHub repository shows its latest commits and pull requests. Link a card to a pull request and it moves to Done when the pull request is merged. See [GitHub](#github).
- **Key dates**: registration deadline, kickoff, submission deadline, shortlist announcement and final presentation. Each can be added to Google Calendar in one click, and every date can be downloaded as a calendar file (one hackathon or all of them).
- **Submission checklist**: repository, demo video, pitch deck and project page links, with a "Ready to submit" check.
- **Results and stats**: record the outcome, placement and prize of each hackathon. **Stats** shows hackathons per month, tracks entered, results and win rate.
- **Reminder emails**: everyone on the team with an account is emailed before the submission deadline (7, 3 and 1 days by default, adjustable per hackathon). They stop once it is submitted. **Email the team** sends a status update with progress, open tasks and missing links, plus an optional note.
- **Notifications**: worked out from your data: deadlines in the coming week, deadlines missed, upcoming key dates, your tasks and project cards that are due, cards someone assigned to you, milestones coming up, being added to a project, and teammates joining.
- **Activity heatmap and public profile**: your profile page shows a year-long heatmap of the days you were taking part in hackathons. You can turn on a public profile at `/u/<your-name>` and share the link: anyone can open it without an account and see the heatmap and the hackathons you choose, with your team role, position (team lead or member), result and prize. See [Public profiles](#public-profiles).
- **Usernames**: every account has a unique username (like `@kishore-k-v`), chosen at sign-up or made from the name. Sign in with it instead of your email; teammates see it on the team list; it is your public profile address. Change it under **Profile → Details**.
- **Friends**: add friends by username (they accept or decline), then invite them to any of your teams or projects with one click. You can also invite anyone by typing their username in a Team or People panel: friends get the invitation straight away, anyone else gets a friend request first and the invitation once they accept. Their email is never shown to the team.
- **Profile links**: GitHub, LinkedIn, LeetCode, Unstop, Devpost, HackerRank, CodeChef, Codeforces, Kaggle, X and a personal website, shown on your public profile.
- **Accounts**: email and password, or Google. New accounts confirm their email address; forgotten passwords can be reset by email. Each user only sees hackathons they own or were invited to.
- **Profile page** (click your initials in the header): change your name or password, connect or disconnect Google, sign out of all devices, or permanently delete your account and its hackathons.
- **Demo login**: one click opens a private, sample-filled account that deletes itself after 24 hours (see [Demo login](#demo-login)).
- **Import**: hackathons saved in the browser by older versions of the app can be imported into an account.
- **Error pages**: clear screens for a missing page or item (404), no access (403), an ended session (401, which returns you to the same page after signing in), no connection (retries by itself when you are back online), the server or database being down (503/500), too many requests (429), a new version after a deploy, and unexpected crashes (with technical details).
- **Loading**: a thin bar along the top while pages or data load, and skeletons shaped like the page. Both appear only when there is a noticeable wait, so fast pages never flicker. Pages are downloaded on demand, so the app starts faster.
- Light and dark mode follow the system setting.

## Tech stack

| Part | Built with |
| --- | --- |
| `client/` | React 19, Vite, React Router 8, Tailwind CSS 4, lucide icons |
| `server/` | Node, Express 5, MongoDB driver, Zod validation, bcrypt passwords, `jose` signed session cookies |
| Database | MongoDB (Atlas or local) |

The repo uses npm workspaces, so one `npm install` at the root sets up both parts.

## Getting started

You need Node.js 22.22 or newer (required by React Router 8) and a MongoDB database.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the repo root by copying `.env.example`, then fill it in (see [Environment variables](#environment-variables)). At minimum set `MONGODB_URI` and `SESSION_SECRET`.

3. Choose a database:
   - **MongoDB Atlas (recommended)**: in Atlas, open your cluster, choose **Connect → Drivers**, and copy the connection string into `MONGODB_URI`. Under **Network Access**, allow the IP address of every machine that runs the server. The free tier is enough.
   - **Local MongoDB**: set `MONGODB_URI=mongodb://127.0.0.1:27017`, then keep this running in its own terminal:

     ```bash
     npm run db
     ```

     It stores data in `.mongo-data/` (git-ignored). Alternatively start the system service with `sudo systemctl start mongodb`.

4. Start the app:

   ```bash
   npm run dev
   ```

   Open http://localhost:5173. Create an account, or click **Try the demo, no account needed**. The server log should show `Connected to MongoDB at …` when it starts.

Collections and indexes are created automatically the first time the server connects.

## Environment variables

All variables live in the root `.env.local` and are read only by the server (`server/src/env.ts`). Never commit `.env.local`; it is git-ignored.

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string, Atlas (`mongodb+srv://…`) or local (`mongodb://127.0.0.1:27017`). |
| `MONGODB_DB` | No | Database name. Default `hacktrack`. |
| `SESSION_SECRET` | Yes | Random string of at least 32 characters used to sign session cookies. Generate one with `openssl rand -base64 32`. |
| `APP_URL` | No | Public address of the app, used to build the Google redirect URI. Default `http://localhost:5173`. |
| `GOOGLE_CLIENT_ID` | No | Enables "Continue with Google" together with the secret below. |
| `GOOGLE_CLIENT_SECRET` | No | See [Google sign-in](#google-sign-in). |
| `API_PORT` | No | Port of the API server in development. Default `4000`. Vite forwards `/api` requests to it. |
| `PORT` | No | Port the server listens on in production. Most hosts set it for you. Default `4000`. |
| `RESEND_API_KEY` | No | Sends email through [Resend](https://resend.com). Without it, emails are printed in the server terminal instead. |
| `EMAIL_FROM` | No | Sender address, which must be on a domain verified in Resend. Default `HackTrack <onboarding@resend.dev>`, which Resend only delivers to your own Resend account address. |
| `EMAIL_TRANSPORT` | No | Set to `log` to print emails instead of sending them even when a Resend key is set. |
| `REMINDER_INTERVAL_MINUTES` | No | How often the server checks for reminder emails to send. Default `15`; `0` turns the built-in check off. |
| `CRON_SECRET` | No | Lets a scheduled job call `POST /api/cron/reminders` (see [Deploying](#deploying)). |
| `GITHUB_TOKEN` | No | GitHub token used to read project repositories. Without it the server can make 60 GitHub requests an hour; with it, 5,000. It needs no scopes. |
| `GITHUB_API_URL` | No | GitHub API address. Default `https://api.github.com`; only change it for GitHub Enterprise or tests. |

### Email

Without a real `RESEND_API_KEY` (or with `EMAIL_TRANSPORT=log`), every email the app would send (verification links, password resets, invites, reminders, team updates) is printed in the terminal running `npm run dev`, between `[mail]` and `[/mail]`. Copy links from there while developing. To really send email, create a Resend account, verify a domain you own, set `RESEND_API_KEY` and `EMAIL_FROM`, and remove `EMAIL_TRANSPORT`. Demo accounts never send email.

## Google sign-in

1. In Google Cloud Console, go to **APIs & Services → Credentials** and create an **OAuth client ID** of type **Web application**.
2. Add this **Authorized redirect URI**: `<APP_URL>/api/auth/google/callback`. In development that is `http://localhost:5173/api/auth/google/callback`. Add your deployed address too when you deploy.
3. Put the client ID and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and restart the server.

Until these are set, the Google button shows a message saying Google sign-in is not set up; email and password still work.

**Connecting Google to an existing account.** On the profile page, **Connect Google** sends you to Google and back, then links that Google account to the account you are signed in to. Your password keeps working, so you can sign in either way. If the Google account uses the same email as your HackTrack account, your email also counts as verified. **Disconnect** removes the link again, as long as the account still has a password. A Google account can only be connected to one HackTrack account.

**Signing in with Google when an account already uses that email.** Password sign-up does not confirm that people own their email address, so Google is treated as the proof. When a Google sign-in uses the email of an account whose email was never verified, the Google user takes that account over: its password and any other Google link are removed, and every session already signed in to it is signed out. This stops anyone from registering someone else's email in advance (and even connecting their own Google account to it) and keeping access once the real owner arrives. An account whose email is verified keeps its existing Google link, and a different Google account cannot claim it.

## Demo login

**Try the demo, no account needed** on the login page creates a private, throwaway account filled with three sample hackathons and a sample project (ReviewPilot) linked to the first one. Their dates are relative to today, so one is always due in 4 days, one in 12, and one is finished.

- Every click gets its own copy, so visitors can change anything without affecting each other.
- A banner reminds demo users that the account is temporary, with a link to create a real one.
- MongoDB deletes demo accounts, their hackathons and their projects automatically after 24 hours, using a TTL index on `expiresAt`. No cron job is needed.
- Each IP address can start up to 30 demos per hour.

This is the easiest way to let a team or judges try the app: deploy it and share the link.

## Usernames

- 3–30 letters, numbers and dashes, starting and ending with a letter or number. Stored in lower case, so `Kishore` and `kishore` are the same name. A few words that clash with app pages (such as `admin`, `api` and `me`) are reserved.
- Chosen at sign-up; the form suggests one from your name. Accounts created with Google or as a demo get one automatically.
- Accounts created before usernames existed get one automatically the next time the server starts (made from the name, with `-2`, `-3`… added when it is taken). The server log says how many it added.
- Sign in with your email, your username, or `@username`.

## Friends

- Open **Friends** in the header. Type a username (suggestions appear as you type) and send a request. It becomes a friendship once they accept. If they had already asked you, sending one back accepts theirs.
- On a hackathon you added, the Team panel lists friends who are not on the team yet, each with an **Invite** button. Pick the role first under **Role for new teammates**. The Friends page also has an **Invite to a team** menu next to each friend.
- A friend invited this way gets a notification and an email. They can **Join team** or **Decline** from the **Team invitations** section of their Friends page. On the team list they appear as `@username`, and their email address is not shown.
- **Invite by username** in a hackathon's Team panel or a project's People panel: type any username (friends are suggested first). A friend gets the invitation straight away. Anyone else gets a friend request first; the request tells them what they were invited to, and the invitation reaches them (with the email, for teams) once they accept. Until then the team or project lists them as **Friend request sent**. Declining or cancelling the friend request withdraws the invitation too.
- Removing a friend or deleting an account removes the friendship and any pending team invites. Demo accounts cannot add friends.

## Projects

Open **Projects** in the header, or **Start a project tracker** in the Project panel of a hackathon page. Starting from a hackathon fills in its name, kickoff and submission dates and submission links, and can invite the teammates who joined with an account.

- **Board**: five columns, Backlog, To do, In progress, In review and Done. Drag a card to another column, or open it and change **Column** (the way to move cards on a phone). Inside a column, cards are sorted by priority, then due date. **Add a card** at the bottom of each column adds one by title. Filter the board by person, milestone or text.
- **Cards**: title, notes, priority, assignee, due date (a day; it counts as late from the next day) and milestone. **Take it** assigns a card to you. Ticking a project card off under **My tasks** moves it to Done.
- **Progress**: the share of cards in Done, one bar split by column, overdue cards, cards finished in the last 7 days, and how many open cards each person has.
- **Milestones**: checkpoints with a due date, each showing how many of its cards are done. Tick one off when it is reached. Deleting a milestone keeps its cards.
- **Activity**: every change to cards, milestones, people and status, newest first (the latest 100 are kept).
- **People**: the owner invites people: friends and teammates from the linked hackathon with one click, or anyone by username (see [Friends](#friends)). They join once they accept from the **Invitations** section of their Friends page, and can decline instead. The owner can withdraw an invitation. Everyone on the project can edit it and move cards; only the owner can invite or remove people or delete the project. Collaborators can leave, and their cards become unassigned.
- **Status**: Idea, Building, Paused, Shipped or Archived.
- **On your profile**: projects stay off your public profile until you tick **Show publicly** next to them on the Profile page. Only the name, pitch, status, tech stack, code and demo links, and the hackathon it was built for (unless that hackathon is hidden) are shown. Archived projects are never shown.

Deleting a hackathon keeps its projects but unlinks them. Deleting your account deletes the projects you own and takes you off the others.

### GitHub

Set a project's **Code repository** link (Edit) to a public GitHub repository, such as `https://github.com/you/project`, and the project page shows:

- stars, language, default branch and last push;
- the latest commits on the default branch;
- open pull requests, and ones merged or closed in the last two weeks, with the card each is linked to.

Open a card and pick its **Pull request**. When that pull request is merged, the card moves to Done and the activity log says so, written as "GitHub". Linking a pull request that is already merged finishes the card straight away.

The repository is read when the project page opens (if the last read is more than five minutes old) and when someone clicks **Refresh**, at most once every 30 seconds per project. Private repositories are not supported. Without `GITHUB_TOKEN` the whole server shares GitHub's limit of 60 requests an hour, and each read uses three, so set a token if many people use the app.

## Profile links

Under **Profile → Links**, type a username or paste a full link for each platform. A username becomes the platform's usual profile link (for example `octocat` becomes `https://github.com/octocat`). A pasted link must point to that platform's site, and every link is saved as `https://`. Website accepts any https address. Clear a field to remove the link. Links appear on your public profile.

## Public profiles

Profiles are private until you turn yours on under **Profile → Public profile**, where you can add an optional bio. The address is `/u/<your username>`, so changing your username moves it. Then **Share** copies the link or opens your device's share menu.

- **Shown publicly:** name, bio, when you joined, profile links, the projects you choose (see [Projects](#projects)), the activity heatmap, and for each hackathon you have not hidden: title, team name, track, dates, your role on the team list, your position (team lead if you added it, member if you were invited), the result with placement and prize, and the project page link.
- **Never shown:** your email, problem statements, tasks, notes, other submission links (such as a private repository), or anything about your teammates.
- Untick **Show publicly** next to a hackathon to leave it off. Hackathons you leave or that are deleted disappear automatically.
- **Make private** turns the link off straight away. A private profile looks exactly like one that does not exist.
- Demo accounts cannot have a public profile.

The heatmap counts, for each day of the last year, how many hackathons you were part of from kickoff to the later of the submission deadline and the final presentation (at most 60 days per hackathon), so it fills in from the dates you already track.

## Scripts

Run these from the repo root.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API server (port 4000) and the React dev server (port 5173) together. |
| `npm run db` | Runs a local MongoDB on port 27017 with data in `.mongo-data/`. Only needed without Atlas. |
| `npm run build` | Builds the React app into `client/dist` and typechecks the server. |
| `npm start` | Runs the production server, which serves the API and the built app from one port. |
| `npm run typecheck` | Typechecks the client and the server. |
| `npm run lint` | Lints the client. |

## Deploying

```bash
npm run build
npm start
```

Express serves both the API and the built React app from one port, so the app deploys as a single Node service (for example on Render or Railway).

- Set `NODE_ENV=production` (the `start` script does this), `MONGODB_URI`, `SESSION_SECRET` and `APP_URL` on the host.
- Serve it over **HTTPS**. In production the session cookie is marked `Secure`, so sign-in will not stick over plain HTTP.
- With Atlas, allow the host's outgoing IP addresses under **Network Access** (or `0.0.0.0/0` if the host has no fixed IP).
- Register `<APP_URL>/api/auth/google/callback` with Google if you use Google sign-in.
- Set `RESEND_API_KEY` and `EMAIL_FROM` so verification, reset, invite and reminder emails are delivered.
- Reminder emails are checked every 15 minutes while the server is running. If your host puts the server to sleep, also set `CRON_SECRET` and have a scheduled job (for example the host's cron feature or GitHub Actions) call this every 15 minutes:

  ```bash
  curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app.example.com/api/cron/reminders
  ```

  Each reminder is claimed in the database before it is sent, so running both never sends one twice.

## Project structure

```
client/
  index.html                Page shell and fonts
  vite.config.ts            Dev server; forwards /api to the Express server
  src/
    main.tsx                Routes; signed-out visitors are sent to /login
    index.css               Design tokens (colours, fonts) and shared .btn / .field styles
    pages/                  Dashboard, hackathon page, Projects, project page, My tasks, Stats, Friends, profile,
                            public profile, login, invite,
                            email confirmation, forgot and reset password, not found
    components/             Timeline, list rows, add/edit form, task checklist, notifications, header
    components/hackathon/   Hackathon page sections: dates, team, reminders, submission, result, project
    components/ErrorScreen.tsx  Error screens for every kind of failure, and the inline "could not load" message
    components/Loading.tsx  Loading bar, app start screen, spinner and page skeletons
    components/project/     Project page sections: board, card editor, milestones, people, activity, details, GitHub
    lib/project.ts          Board columns, project statuses and date helpers
    lib/api.ts              Every request the client makes to the server
    lib/types.ts            Hackathon types shared with the server
server/
  src/
    index.ts                Express app, error handling, serves client/dist in production
    env.ts                  Loads .env.local and exposes settings
    db.ts                   MongoDB connection and indexes
    models.ts               Document types and request validation
    session.ts              Signed session cookies
    auth-middleware.ts      Rejects requests without a valid session
    sample-data.ts          Sample hackathons for new accounts and demos, and the demo project
    mailer.ts, emails.ts    Sending email (Resend or the log) and every email's wording
    tokens.ts               Single-use links for email confirmation and password reset
    reminders.ts            Finds and sends due reminder emails
    calendar.ts             Builds .ics calendar files
    google-account.ts       Rules for linking Google accounts
    usernames.ts            Username rules, suggestions and the start-up backfill
    routes/auth.ts          Sign up, sign in, email confirmation, password reset, profile, demo, Google
    routes/hackathons.ts    Hackathons, tasks, team, team emails, calendar files, My tasks
    routes/invites.ts       Viewing and accepting team invites
    routes/notifications.ts Notifications worked out from deadlines, tasks and team activity
    routes/cron.ts          Endpoint for scheduled reminder runs
    routes/profile.ts       Profile settings and public profiles
    routes/friends.ts       Friend requests and friend lists
    routes/projects.ts      Projects, board cards, milestones, invitations, GitHub sync, project My tasks
    github.ts               Reads public GitHub repositories
    held-invites.ts         Invitations that wait until a friend request is accepted
    social-links.ts         Profile link platforms and link checks
```

## API

All endpoints are under `/api`, take and return JSON, and report problems as `{ "error": "message" }`. Signing in sets an HTTP-only `session` cookie, which the hackathon endpoints require.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | Create an account (`name`, `email`, `password` of 8+ characters, optional `username`) and sign in. |
| `POST` | `/api/auth/login` | Sign in with `login` (email or username) and `password`. |
| `POST` | `/api/auth/logout` | Sign out. |
| `GET` | `/api/auth/me` | The signed-in user, or 401. |
| `PATCH` | `/api/auth/me` | Change your display name (`name`) and/or `username`. |
| `DELETE` | `/api/auth/me` | Delete your account and its hackathons. Needs `confirmEmail` (your email, or `delete` for demo accounts) and `password` for password accounts. |
| `POST` | `/api/auth/password` | Change your password (`currentPassword`, `newPassword`). Signs out your other devices. |
| `POST` | `/api/auth/logout-all` | Sign out of every device. |
| `POST` | `/api/auth/demo` | Start a demo session in a new throwaway account. |
| `GET` | `/api/auth/google` | Start Google sign-in (browser redirect). With `?link=1`, connect Google to the signed-in account instead. |
| `DELETE` | `/api/auth/google` | Disconnect Google from your account (only if it also has a password). |
| `GET` | `/api/auth/google/callback` | Where Google returns after sign-in. |
| `GET` | `/api/hackathons` | List your hackathons, newest first. |
| `POST` | `/api/hackathons` | Create a hackathon. |
| `POST` | `/api/hackathons/import` | Create up to 100 hackathons at once (`{ "hackathons": [...] }`). |
| `POST` | `/api/hackathons/samples` | Add the sample hackathons to your account. |
| `GET` | `/api/hackathons/:id` | Get one hackathon. |
| `PUT` | `/api/hackathons/:id` | Replace a hackathon's editable fields. |
| `DELETE` | `/api/hackathons/:id` | Delete a hackathon (owner only). |
| `PATCH` | `/api/hackathons/:id/tasks/:taskId` | Tick a task on or off (`completed`). |
| `POST` | `/api/hackathons/:id/team` | Invite a teammate by `email`, a friend by `friendId`, or anyone by `username`, with a `role` (owner only). With `username`, someone who is not a friend gets a friend request first (`awaitingFriend: true`). |
| `DELETE` | `/api/hackathons/:id/team/:operativeId` | Remove a teammate (owner), or leave the team (yourself). |
| `POST` | `/api/hackathons/:id/email-team` | Email everyone on the team a status update (`note` optional; once per 10 minutes). |
| `GET` | `/api/hackathons/:id/calendar.ics` | Calendar file with the hackathon's key dates. |
| `GET` | `/api/hackathons/calendar.ics` | Calendar file with every key date of all your hackathons. |
| `GET` | `/api/hackathons/my-tasks` | Tasks assigned to you across all hackathons. |
| `GET` | `/api/invites/:token` | What an invite is for (works signed out). |
| `POST` | `/api/invites/:token/accept` | Join the team with the signed-in account. |
| `GET` | `/api/notifications` | Your notifications. |
| `POST` | `/api/notifications/read-all` | Mark all notifications read. |
| `POST` | `/api/auth/resend-verification` | Email the confirmation link again. |
| `POST` | `/api/auth/verify-email` | Confirm an email address (`token`). |
| `POST` | `/api/auth/forgot-password` | Email a password reset link (`email`). Always answers the same way. |
| `POST` | `/api/auth/reset-password` | Set a new password (`token`, `newPassword`) and sign out other devices. |
| `POST` | `/api/cron/reminders` | Send due reminder emails. Needs `Authorization: Bearer <CRON_SECRET>`. |
| `GET` | `/api/profile/me` | Your profile settings and every hackathon you are on, with which ones are hidden. |
| `PATCH` | `/api/profile/me` | Change `isPublic`, `handle`, `bio`, `hiddenHackathonIds`, `shownProjectIds` or `links` (platform id to username or URL; empty string removes). |
| `GET` | `/api/friends` | Your friends and pending requests either way. |
| `GET` | `/api/friends/search?q=` | People whose username starts with `q` (2+ characters). |
| `POST` | `/api/friends/requests` | Send a friend request (`username`). |
| `POST` | `/api/friends/requests/:id/accept` | Accept a request sent to you. |
| `DELETE` | `/api/friends/requests/:id` | Decline a request, or cancel one you sent. |
| `DELETE` | `/api/friends/:userId` | Remove a friend. |
| `GET` | `/api/invites/mine` | Team invites sent to your account by friends. |
| `POST` | `/api/invites/by-id/:id/accept` | Join a team from a friend's invite. |
| `DELETE` | `/api/invites/by-id/:id` | Decline a friend's team invite. |
| `GET` | `/api/profile/:handle` | A public profile; works without signing in, 404 if it is private or unknown. |
| `GET` | `/api/projects` | Your projects, most recently changed first. `?hackathonId=` narrows to one hackathon. |
| `POST` | `/api/projects` | Create a project (`title`, optional `tagline`, `description`, `status`, `hackathonId`, `techStack`, `links`, `startDate`, `targetDate`, and `addTeammates` to add the hackathon's teammates). |
| `GET` | `/api/projects/my-tasks` | Project cards assigned to you. |
| `GET` | `/api/projects/:id` | One project with its board, milestones, people and activity. |
| `PATCH` | `/api/projects/:id` | Change any of the project's details. |
| `DELETE` | `/api/projects/:id` | Delete a project (owner only). |
| `POST` | `/api/projects/:id/tasks` | Add a card (`title`, optional `column`, `priority`, `assigneeId`, `dueDate`, `milestoneId`, `notes`). |
| `PATCH` | `/api/projects/:id/tasks/:taskId` | Move, assign or edit a card; send only the fields that changed. |
| `DELETE` | `/api/projects/:id/tasks/:taskId` | Delete a card. |
| `POST` | `/api/projects/:id/milestones` | Add a milestone (`title`, optional `dueDate`). |
| `PATCH` | `/api/projects/:id/milestones/:milestoneId` | Rename, re-date or tick off (`done`) a milestone. |
| `DELETE` | `/api/projects/:id/milestones/:milestoneId` | Delete a milestone; its cards stay. |
| `GET` | `/api/projects/:id/candidates` | Friends and linked-hackathon teammates the owner can add. |
| `POST` | `/api/projects/:id/members` | Invite someone (`userId` of a friend or linked-hackathon teammate, or any `username`; owner only). Answers with `awaitingFriend: true` when they get a friend request first. |
| `DELETE` | `/api/projects/:id/members/:userId` | Remove a collaborator (owner), or leave (yourself). |
| `DELETE` | `/api/projects/:id/invites/:userId` | Withdraw an invitation (owner only). |
| `GET` | `/api/projects/invites/mine` | Project invitations waiting for you. |
| `POST` | `/api/projects/:id/invite/accept` | Accept a project invitation and join. |
| `DELETE` | `/api/projects/:id/invite` | Decline a project invitation. |
| `POST` | `/api/projects/:id/github/sync` | Read the linked GitHub repository and move cards whose pull request was merged to Done. Returns the saved copy if it was read in the last 30 seconds. |

`PUT /api/hackathons/:id` must include the `version` it was loaded with. If someone saved a newer version in the meantime, it answers `409` with the latest copy in `hackathon`.

A hackathon you are not on the team of, or a project you are not on, always returns 404.

## Data model

- **`users`**: one document per account with email (unique), name, bcrypt password hash and/or Google id, `emailVerified`, `sessionVersion`, username (`handle`, unique, lower case), public profile settings (`profilePublic`, `bio`, `hiddenHackathonIds`, `profileProjectIds`), and for demo accounts `isDemo` and `expiresAt`. Each session cookie records the `sessionVersion` it was issued for, and the server rejects it once that number changes, which is how all of an account's sessions are signed out at once.
- **`hackathons`**: one document per hackathon, owned by a user (`ownerId`) and shared with the accounts in `memberIds`, with its tasks, team list, submission links, result and reminder settings embedded. `version` increases on every edit. `remindersSent` records which reminder emails went out. Demo hackathons also carry `expiresAt`. Hackathons saved before these fields existed get defaults when they are read.
- **`projects`**: one document per project, owned by a user (`ownerId`) and shared with `memberIds` (with who invited each person in `members`), with its cards (`tasks`), milestones, the latest 100 activity lines, invitations not yet answered (`pendingInvites`, each marked `waitingForFriendship` until a friend request is accepted) and the last copy read from GitHub (`github`) embedded. Cards are changed one at a time with targeted updates, so two people moving different cards never overwrite each other. `hackathonId` links it to a hackathon. Demo projects carry `expiresAt`.
- **`friendships`**: one document per pair of people (`pairKey` is their two ids sorted, unique), `pending` until the other person accepts.
- **`invites`**: pending team invites (invites to an account also record `inviteeUserId`; ones waiting on a friend request carry `waitingForFriendship` and stay hidden from the invitee until it is accepted). Only a hash of the link's token is stored, and invites expire after 14 days.
- **`tokens`**: single-use email confirmation (2 days) and password reset (1 hour) links, also stored as hashes and deleted automatically when they expire.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "The app cannot reach its database right now" on the login page, or `Cannot reach MongoDB` in the server log | MongoDB is not reachable. Locally, run `npm run db`. With Atlas, check `MONGODB_URI` and that your current IP is allowed under **Network Access**. |
| `SESSION_SECRET must be set` | Add a `SESSION_SECRET` of at least 32 characters to `.env.local` and restart. |
| Changes to `.env.local` have no effect | The server reads it only at startup. Stop `npm run dev` and start it again. |
| "Google sign-in is not set up yet" | Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, see [Google sign-in](#google-sign-in). |
| Google shows `redirect_uri_mismatch` | The redirect URI registered with Google must exactly match `<APP_URL>/api/auth/google/callback`. |
| Signed in but immediately signed out again in production | The site is served over plain HTTP. Use HTTPS. |
| Emails do not arrive | Check the server terminal: with `EMAIL_TRANSPORT=log` or no Resend key they are printed there. With Resend, look for a "was not sent" line; the sender must be on a verified domain, and `onboarding@resend.dev` only delivers to your own Resend account address. |
| Reminder emails never arrive | They go only to team members with accounts, only while the hackathon is not submitted, and only once the deadline is within a chosen number of days. If the host sleeps, set up the cron call described under [Deploying](#deploying). |

## Known limitations

- Hackathons can only be linked to Google Calendar one date at a time, or by downloading a calendar file; there is no live calendar sync.
- Notifications are shown in the app only; apart from reminders and team updates there are no notification emails or push notifications.
- Project cards cannot be put in a custom order inside a column (they are sorted by priority, then due date), and project milestones are not in the calendar files yet.
- The board does not update live: changes teammates make appear when the page is reloaded or you make a change yourself.
- GitHub: only public repositories, and merged pull requests are noticed when the project page is opened or refreshed (there is no webhook), so a card can stay in its column until someone opens the project.
