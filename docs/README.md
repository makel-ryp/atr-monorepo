# Customer Documentation

This folder is for your company's documentation, integrated with the docs app at `localhost:3000`.

## How It Works

Content you add here is automatically pulled into the documentation site:

| You write to | Appears at URL |
|--------------|----------------|
| `/docs/internal/2.my-team/guide.md` | `/internal/my-team/guide` (alongside app-agent docs) |
| `/docs/2.company/handbook.md` | `/company/handbook` (top-level section) |
| `/docs/3.processes/onboarding.md` | `/processes/onboarding` (top-level section) |

## Folder Structure

```
/docs/
├── internal/              # Merges into /internal/ section
│   └── 2.your-team/       # Numbered for navigation order
│       ├── 0.index.md     # Section landing page
│       └── 1.guide.md     # Your content
│
├── 2.company/             # Top-level section at /company/
│   ├── 0.index.md
│   └── handbook.md
│
└── 3.processes/           # Top-level section at /processes/
    └── onboarding.md
```

## Numbering Convention

Prefix folders and files with numbers to control navigation order:
- `1.getting-started/` appears before `2.guides/`
- `0.index.md` is the section landing page
- Numbers are stripped from URLs (`2.company` → `/company`)

## What NOT to Edit

The `/core/docs/content/internal/app-agent/` folder is upstream-maintained. Editing it will cause merge conflicts when you pull updates.

Write your internal docs to `/docs/internal/` instead - they appear in the same navigation but stay conflict-free.
