# Contributing to Schichtplaner

Thanks for your interest in contributing! Here's everything you need to get started.

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

## Setting Up Your Development Environment

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/schichtplaner.git
cd schichtplaner

# Install dependencies
npm install

# Start services
docker compose up -d postgres redis minio

# Set up the database
cp .env.example .env
npx prisma migrate dev
npx prisma db seed

# Start the dev server
npm run dev
```

## Workflow

1. **Create an issue** — describe the problem or feature
2. **Create a branch** — `git checkout -b feature/my-feature` or `fix/my-bugfix`
3. **Develop** — write code, test your changes
4. **Verify** — `npm run lint && npx tsc --noEmit`
5. **Pull request** — open a PR against `main`

## Conventions

### Code

- **Language:** UI text is localized via next-intl (`messages/{fr,de,en}.json`, French is default); code and variables are English
- **i18n:** user-facing strings go through translation keys, not hardcoded text — see the i18n section in [AGENTS.md](AGENTS.md)
- **Validation:** Zod schemas for all API inputs
- **API pattern:** `getCurrentMember()` → role check → Zod validation → Prisma query
- **Imports:** `@/*` alias maps to `./src/*`

### Commits

We use conventional commit messages:

```
feat: new feature
fix: bug fix
docs: documentation
refactor: code refactoring
chore: maintenance, dependencies
```

### Branches

- `main` — stable branch
- `feature/*` — new features
- `fix/*` — bug fixes

## Modifying the Database Schema

```bash
# Edit the schema in prisma/schema.prisma
# Create a migration
npx prisma migrate dev --name describe_the_change

# Regenerate the Prisma client
npx prisma generate
```

## Creating a New API Route

Every API route follows this pattern:

```typescript
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  // Zod schema here
});

export async function POST(request: Request) {
  const t = await getTranslations();
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  if (!isManagerOrAbove(member.role)) return NextResponse.json({ error: t("errors.forbidden") }, { status: 403 });

  const body = await request.json();
  const data = schema.parse(body);

  const result = await prisma.model.create({
    data: { ...data, organizationId: member.organizationId },
  });

  return NextResponse.json(result);
}
```

## Questions?

Open an [issue](https://github.com/lennystepn-hue/schichtplaner/issues) — we're happy to help.
