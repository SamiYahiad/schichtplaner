# Schichtplaner 2.0 – Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a modern, multi-tenant shift planning SaaS tool with AI features, replacing the legacy Bootstrap 3/jQuery tool at schichtplaner-online.de.

**Architecture:** Full-stack Next.js 15 monolith with App Router, Prisma ORM on PostgreSQL, Socket.io for realtime, Claude API for AI features. Self-hosted via Docker Compose with Caddy reverse proxy.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Prisma, PostgreSQL 16, NextAuth.js v5, Socket.io, Claude API, next-intl, dnd-kit, Recharts, Zod, Docker Compose.

**Design Doc:** `docs/plans/2026-03-01-schichtplaner-design.md`
**Original Tool Docs:** `/root/Desktop/schichtplaner-online-VOLLSTAENDIGE-DOKUMENTATION.md`

---

## Phase 1: Project Scaffolding & Infrastructure

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.env.example`, `.gitignore`

**Step 1: Create Next.js app with TypeScript + Tailwind**

```bash
cd /root/workspace/schichtplaner
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

Accept defaults. This creates the base Next.js 15 project with App Router.

**Step 2: Install core dependencies**

```bash
npm install prisma @prisma/client next-auth@beta @auth/prisma-adapter
npm install zod zustand @tanstack/react-query socket.io socket.io-client
npm install next-intl date-fns sonner lucide-react
npm install @anthropic-ai/sdk
npm install -D @types/node
```

**Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init -d
```

Select: New York style, Slate base color, CSS variables: yes.

**Step 4: Add commonly used shadcn components**

```bash
npx shadcn@latest add button card dialog dropdown-menu input label select sheet table tabs toast badge calendar popover command avatar separator skeleton switch textarea tooltip
```

**Step 5: Create `.env.example`**

```env
# Database
DATABASE_URL="postgresql://schichtplaner:schichtplaner@localhost:5432/schichtplaner"

# Auth
NEXTAUTH_SECRET="generate-a-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# AI
ANTHROPIC_API_KEY="sk-ant-..."

# Redis
REDIS_URL="redis://localhost:6379"

# MinIO (S3-compatible)
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="schichtplaner"

# App
APP_URL="http://localhost:3000"
```

Copy to `.env`:
```bash
cp .env.example .env
```

**Step 6: Update `.gitignore`**

Ensure these are in `.gitignore`:
```
.env
.env.local
node_modules/
.next/
```

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize Next.js 15 project with core dependencies"
```

---

### Task 2: Docker Compose Setup

**Files:**
- Create: `docker-compose.yml`, `Dockerfile`, `server.ts`

**Step 1: Create `docker-compose.yml`**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: schichtplaner
      POSTGRES_PASSWORD: schichtplaner
      POSTGRES_DB: schichtplaner
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U schichtplaner"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

**Step 2: Create custom server `server.ts`** (for Socket.io)

```typescript
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/api/ws",
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("join:org", (orgId: string) => {
      socket.join(`org:${orgId}`);
    });

    socket.on("join:schedule", (scheduleId: string) => {
      socket.join(`schedule:${scheduleId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // Make io accessible to API routes
  (globalThis as any).__socketIO = io;

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
```

**Step 3: Add custom server script to `package.json`**

Add to `scripts`:
```json
{
  "dev:server": "tsx watch server.ts",
  "start:server": "node dist/server.js"
}
```

Install tsx:
```bash
npm install tsx
```

**Step 4: Create `Dockerfile`**

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "server.js"]
```

**Step 5: Commit**

```bash
git add docker-compose.yml Dockerfile server.ts package.json
git commit -m "chore: add Docker Compose (postgres, redis, minio) + custom server"
```

---

### Task 3: Prisma Schema

**Files:**
- Create: `prisma/schema.prisma`

**Step 1: Initialize Prisma**

```bash
npx prisma init
```

**Step 2: Write the full schema in `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// AUTH & USERS
// ============================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?
  firstName     String
  lastName      String
  nickname      String?
  phone         String?
  profileImage  String?
  locale        String    @default("de")
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  memberships       OrganizationMember[]
  sentMessages      Message[]            @relation("sender")
  messageRecipients MessageRecipient[]
  notes             EmployeeNote[]       @relation("subject")
  authoredNotes     EmployeeNote[]       @relation("author")
  bookings          Booking[]
  timeRecords       TimeRecord[]
  absences          Absence[]
  modRequests       ModRequest[]
  liveLogs          LiveLog[]
  topicPosts        TopicPost[]
  uploadedFiles     PortalFile[]

  @@map("users")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// ============================================
// ORGANIZATIONS (Multi-Tenant)
// ============================================

model Organization {
  id           String   @id @default(cuid())
  name         String
  address      String?
  nameFormat   NameFormat @default(LASTNAME_FIRSTNAME)
  scheduleVisibility ScheduleVisibility @default(ALL)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deletedAt    DateTime?

  members           OrganizationMember[]
  branches          Branch[]
  divisions         Division[]
  schedules         Schedule[]
  timeCategories    TimeCategory[]
  timeSettings      TimeSettings?
  absenceCategories AbsenceCategory[]
  messages          Message[]
  portalFolders     PortalFolder[]
  portalFiles       PortalFile[]
  topics            Topic[]
  holidays          Holiday[]
  settings          OrgSettings?

  @@map("organizations")
}

model OrganizationMember {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  role           OrgRole  @default(EMPLOYEE)
  isActive       Boolean  @default(true)
  isActivated    Boolean  @default(false)
  activationToken String? @unique
  joinedAt       DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
  @@map("organization_members")
}

enum OrgRole {
  OWNER
  ADMIN
  MANAGER
  EMPLOYEE
}

enum NameFormat {
  LASTNAME_FIRSTNAME
  FIRSTNAME_LASTNAME
  LASTNAME
  FIRSTNAME
  NICKNAME
}

enum ScheduleVisibility {
  ALL
  OWN_ONLY
}

// ============================================
// BRANCHES (Filialen)
// ============================================

model Branch {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  address        String?
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  schedules    Schedule[]

  @@map("branches")
}

// ============================================
// DIVISIONS (Arbeitsbereiche)
// ============================================

model Division {
  id             String   @id @default(cuid())
  organizationId String
  title          String
  description    String?
  color          String   @default("#6366f1")
  isSystem       Boolean  @default(false)
  createdAt      DateTime @default(now())
  deletedAt      DateTime?

  organization Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  members      DivisionMember[]
  shifts       Shift[]

  @@map("divisions")
}

model DivisionMember {
  divisionId String
  userId     String

  division Division @relation(fields: [divisionId], references: [id], onDelete: Cascade)

  @@id([divisionId, userId])
  @@map("division_members")
}

// ============================================
// SCHEDULES (Schichtpläne)
// ============================================

model Schedule {
  id             String   @id @default(cuid())
  organizationId String
  branchId       String?
  weekNumber     Int
  year           Int
  isPublic       Boolean  @default(false)
  settingsLayout ScheduleLayout @default(LAYOUT_1)
  showTitle      Boolean  @default(true)
  showPauses     Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?

  organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  branch       Branch?       @relation(fields: [branchId], references: [id])
  shifts       Shift[]
  briefings    Briefing[]
  liveSession  LiveSession?

  @@unique([organizationId, weekNumber, year, branchId])
  @@map("schedules")
}

enum ScheduleLayout {
  LAYOUT_1
  LAYOUT_2
}

// ============================================
// SHIFTS (Schichten)
// ============================================

model Shift {
  id           String   @id @default(cuid())
  scheduleId   String
  divisionId   String?
  dayOfWeek    Int      // 1=Mon, 7=Sun
  shiftFrom    String   // "08:00"
  shiftTo      String   // "17:00"
  maxEmployees Int      @default(1)
  pauseOption  PauseOption @default(PER_HOUR)
  pauseValue   Int      @default(0) // minutes
  title        String?
  description  String?
  createdAt    DateTime @default(now())
  deletedAt    DateTime?

  schedule    Schedule     @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  division    Division?    @relation(fields: [divisionId], references: [id])
  bookings    Booking[]
  modRequests ModRequest[]

  @@map("shifts")
}

enum PauseOption {
  PER_HOUR
  PER_SHIFT
}

// ============================================
// BOOKINGS (MA in Schicht)
// ============================================

model Booking {
  id        String   @id @default(cuid())
  shiftId   String
  userId    String
  bookedAt  DateTime @default(now())
  bookedBy  String?  // admin who booked

  shift Shift @relation(fields: [shiftId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([shiftId, userId])
  @@map("bookings")
}

// ============================================
// MOD REQUESTS (Wunschplan-Anfragen)
// ============================================

model ModRequest {
  id        String        @id @default(cuid())
  shiftId   String
  userId    String
  state     RequestState  @default(OPEN)
  deadline  DateTime?
  sentAt    DateTime      @default(now())

  shift Shift @relation(fields: [shiftId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([shiftId, userId])
  @@map("mod_requests")
}

enum RequestState {
  OPEN
  ACCEPTED
  DECLINED
}

// ============================================
// BRIEFINGS
// ============================================

model Briefing {
  id         String   @id @default(cuid())
  scheduleId String
  text       String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  schedule Schedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)

  @@map("briefings")
}

// ============================================
// LIVE MODE
// ============================================

model LiveSession {
  id              String   @id @default(cuid())
  scheduleId      String   @unique
  isActive        Boolean  @default(true)
  deadline        DateTime?
  autoStop        Boolean  @default(false)
  allowExceeds    Boolean  @default(false)
  bookRequests    Boolean  @default(false)
  startedAt       DateTime @default(now())

  schedule Schedule   @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  days     LiveDay[]
  logs     LiveLog[]

  @@map("live_sessions")
}

model LiveDay {
  id            String  @id @default(cuid())
  liveSessionId String
  dayOfWeek     Int
  enabled       Boolean @default(true)

  liveSession LiveSession @relation(fields: [liveSessionId], references: [id], onDelete: Cascade)

  @@unique([liveSessionId, dayOfWeek])
  @@map("live_days")
}

model LiveLog {
  id            String   @id @default(cuid())
  liveSessionId String
  shiftId       String
  userId        String
  action        LiveAction
  loggedAt      DateTime @default(now())

  liveSession LiveSession @relation(fields: [liveSessionId], references: [id], onDelete: Cascade)
  user        User        @relation(fields: [userId], references: [id])

  @@map("live_logs")
}

enum LiveAction {
  BOOK
  UNBOOK
}

// ============================================
// TIME TRACKING (Zeiterfassung)
// ============================================

model TimeRecord {
  id             String       @id @default(cuid())
  userId         String
  date           DateTime     @db.Date
  timeFrom       String?      // "08:00"
  timeTo         String?      // "17:00"
  durationHours  Int?
  durationMinutes Int?
  type           TimeRecordType
  categoryId     String?
  comment        String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  user     User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  category TimeCategory? @relation(fields: [categoryId], references: [id])

  @@map("time_records")
}

enum TimeRecordType {
  MANUAL
  WATCH
  MANUAL_DURATION
}

model TimeCategory {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  enabled        Boolean  @default(true)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  records      TimeRecord[]

  @@map("time_categories")
}

model TimeSettings {
  id               String   @id @default(cuid())
  organizationId   String   @unique
  trackingOptions  String?
  watchAutoStop    Boolean  @default(false)
  warningsEnabled  Boolean  @default(false)
  warningsMaxHours Int      @default(10)
  whoCanUse        WhoCanUse @default(ALL)
  useCategories    Boolean  @default(false)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@map("time_settings")
}

enum WhoCanUse {
  ALL
  CHOOSE
}

// ============================================
// ABSENCES (Abwesenheiten)
// ============================================

model Absence {
  id         String       @id @default(cuid())
  userId     String
  categoryId String
  dateFrom   DateTime     @db.Date
  dateTo     DateTime     @db.Date
  note       String?
  status     AbsenceStatus @default(PENDING)
  createdAt  DateTime     @default(now())

  user     User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  category AbsenceCategory @relation(fields: [categoryId], references: [id])

  @@map("absences")
}

enum AbsenceStatus {
  PENDING
  APPROVED
  DECLINED
}

model AbsenceCategory {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  color          String   @default("#ef4444")
  isPaid         Boolean  @default(true)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  absences     Absence[]

  @@map("absence_categories")
}

// ============================================
// HOLIDAYS (Feiertage)
// ============================================

model Holiday {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  date           DateTime @db.Date
  country        String   @default("DE")
  state          String?  // Bundesland

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@map("holidays")
}

// ============================================
// MESSAGES (Nachrichten)
// ============================================

model Message {
  id             String   @id @default(cuid())
  organizationId String
  senderId       String
  subject        String
  body           String
  parentId       String?  // for replies
  createdAt      DateTime @default(now())

  organization Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  sender       User               @relation("sender", fields: [senderId], references: [id])
  parent       Message?           @relation("replies", fields: [parentId], references: [id])
  replies      Message[]          @relation("replies")
  recipients   MessageRecipient[]

  @@map("messages")
}

model MessageRecipient {
  messageId String
  userId    String
  isRead    Boolean @default(false)
  isDeleted Boolean @default(false)

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([messageId, userId])
  @@map("message_recipients")
}

// ============================================
// PORTAL FILES (Dateien)
// ============================================

model PortalFolder {
  id             String   @id @default(cuid())
  organizationId String
  parentId       String?
  name           String
  createdAt      DateTime @default(now())

  organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  parent       PortalFolder? @relation("subfolders", fields: [parentId], references: [id])
  children     PortalFolder[] @relation("subfolders")
  files        PortalFile[]

  @@map("portal_folders")
}

model PortalFile {
  id             String   @id @default(cuid())
  organizationId String
  folderId       String?
  name           String
  path           String
  size           Int
  mimeType       String?
  uploadedById   String
  createdAt      DateTime @default(now())

  organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  folder       PortalFolder? @relation(fields: [folderId], references: [id])
  uploadedBy   User          @relation(fields: [uploadedById], references: [id])

  @@map("portal_files")
}

// ============================================
// PORTAL TOPICS (Forum)
// ============================================

model Topic {
  id             String   @id @default(cuid())
  organizationId String
  title          String
  createdById    String
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  posts        TopicPost[]

  @@map("topics")
}

model TopicPost {
  id        String   @id @default(cuid())
  topicId   String
  userId    String
  text      String
  createdAt DateTime @default(now())

  topic Topic @relation(fields: [topicId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id])

  @@map("topic_posts")
}

// ============================================
// EMPLOYEE NOTES
// ============================================

model EmployeeNote {
  id         String   @id @default(cuid())
  subjectId  String   // the employee this note is about
  authorId   String   // who wrote it
  text       String
  createdAt  DateTime @default(now())

  subject User @relation("subject", fields: [subjectId], references: [id], onDelete: Cascade)
  author  User @relation("author", fields: [authorId], references: [id])

  @@map("employee_notes")
}

// ============================================
// ORG SETTINGS
// ============================================

model OrgSettings {
  id                String  @id @default(cuid())
  organizationId    String  @unique
  aiEnabled         Boolean @default(true)
  aiAutoPlanner     Boolean @default(true)
  aiAnomalyDetection Boolean @default(true)
  aiChatEnabled     Boolean @default(true)
  aiForecast        Boolean @default(true)
  aiSmartBriefing   Boolean @default(true)
  smsEnabled        Boolean @default(false)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@map("org_settings")
}
```

**Step 3: Start Docker services and run migration**

```bash
docker compose up -d postgres redis minio
npx prisma migrate dev --name init
```

**Step 4: Create Prisma client singleton `src/lib/db.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

**Step 5: Commit**

```bash
git add prisma/ src/lib/db.ts
git commit -m "feat: add Prisma schema with full data model (20+ tables)"
```

---

### Task 4: Authentication (NextAuth.js v5)

**Files:**
- Create: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts`
- Create: `src/app/[locale]/(auth)/login/page.tsx`, `src/app/[locale]/(auth)/register/page.tsx`

**Step 1: Create auth config `src/lib/auth.ts`**

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
```

Install bcryptjs:
```bash
npm install bcryptjs @types/bcryptjs
```

**Step 2: Create route handler `src/app/api/auth/[...nextauth]/route.ts`**

```typescript
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

**Step 3: Create auth middleware `src/middleware.ts`**

```typescript
import { auth } from "@/lib/auth";
import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes
  const publicPaths = ["/login", "/register", "/activate", "/api/auth"];
  const isPublic = publicPaths.some((p) => pathname.includes(p));

  if (!isPublic) {
    const session = await auth();
    if (!session) {
      return Response.redirect(new URL("/login", req.url));
    }
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!_next|api/auth|favicon.ico|.*\\..*).*)"],
};
```

**Step 4: Create Registration API `src/app/api/auth/register/route.ts`**

```typescript
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, firstName, lastName, companyName } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, firstName, lastName },
    });

    const org = await tx.organization.create({
      data: {
        name: companyName,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
            isActive: true,
            isActivated: true,
          },
        },
        divisions: {
          create: {
            title: "Alle",
            description: "Standard-Arbeitsbereich",
            isSystem: true,
          },
        },
      },
    });

    return { user, org };
  });

  return NextResponse.json({ userId: result.user.id, orgId: result.org.id }, { status: 201 });
}
```

**Step 5: Create Login page `src/app/[locale]/(auth)/login/page.tsx`**

```tsx
"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("Ungültige Anmeldedaten");
      setLoading(false);
    } else {
      router.push("/schedule/flexible");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Schichtplaner</CardTitle>
          <p className="text-sm text-muted-foreground">Anmelden</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Wird angemeldet..." : "Anmelden"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Noch kein Konto?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Registrieren
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 6: Create Register page `src/app/[locale]/(auth)/register/page.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      companyName: formData.get("companyName") as string,
    };

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Registrierung fehlgeschlagen");
      setLoading(false);
      return;
    }

    await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    router.push("/schedule/flexible");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Firma registrieren</CardTitle>
          <p className="text-sm text-muted-foreground">Erstelle deinen Schichtplaner-Account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Vorname</Label>
                <Input id="firstName" name="firstName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nachname</Label>
                <Input id="lastName" name="lastName" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Firmenname</Label>
              <Input id="companyName" name="companyName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort (min. 6 Zeichen)</Label>
              <Input id="password" name="password" type="password" minLength={6} required />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Wird erstellt..." : "Registrieren"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Bereits registriert?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Anmelden
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 7: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/ src/middleware.ts src/app/\[locale\]/\(auth\)/
git commit -m "feat: add authentication (NextAuth.js v5, login, register, middleware)"
```

---

### Task 5: i18n Setup (next-intl)

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/request.ts`, `messages/de.json`, `messages/en.json`

**Step 1: Install and configure next-intl**

```bash
npm install next-intl
```

**Step 2: Create routing config `src/i18n/routing.ts`**

```typescript
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["de", "en"],
  defaultLocale: "de",
});
```

**Step 3: Create request config `src/i18n/request.ts`**

```typescript
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

**Step 4: Update `next.config.ts`**

```typescript
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig = {
  output: "standalone",
};

export default withNextIntl(nextConfig);
```

**Step 5: Create German translations `messages/de.json`**

```json
{
  "nav": {
    "schedule": "Schichtpläne",
    "time": "Zeiterfassung",
    "employees": "Mitarbeiter",
    "divisions": "Arbeitsbereiche",
    "portal": "Portal",
    "reporting": "Auswertung",
    "settings": "Einstellungen",
    "ai": "KI-Assistent"
  },
  "auth": {
    "login": "Anmelden",
    "register": "Registrieren",
    "logout": "Abmelden",
    "email": "E-Mail",
    "password": "Passwort",
    "firstName": "Vorname",
    "lastName": "Nachname",
    "companyName": "Firmenname",
    "invalidCredentials": "Ungültige Anmeldedaten",
    "alreadyRegistered": "Bereits registriert?",
    "noAccount": "Noch kein Konto?"
  },
  "common": {
    "save": "Speichern",
    "cancel": "Abbrechen",
    "delete": "Löschen",
    "edit": "Bearbeiten",
    "create": "Erstellen",
    "search": "Suchen",
    "filter": "Filtern",
    "export": "Exportieren",
    "loading": "Wird geladen...",
    "noResults": "Keine Ergebnisse",
    "confirm": "Bestätigen",
    "back": "Zurück",
    "next": "Weiter",
    "all": "Alle",
    "active": "Aktiv",
    "inactive": "Inaktiv"
  },
  "schedule": {
    "title": "Schichtplan",
    "createShift": "Schicht erstellen",
    "editShift": "Schicht bearbeiten",
    "deleteShift": "Schicht löschen",
    "bookEmployee": "Mitarbeiter eintragen",
    "unbookEmployee": "Mitarbeiter austragen",
    "allEmployees": "Alle Mitarbeiter",
    "visibility": "Sichtbarkeit",
    "setPublic": "Veröffentlichen",
    "setPrivate": "Verbergen",
    "liveMode": "Live-Modus",
    "startLive": "Live starten",
    "stopLive": "Live stoppen",
    "briefing": "Briefing",
    "wishPlan": "Wunschplan",
    "options": "Optionen",
    "calendarWeek": "KW",
    "shiftFull": "Voll besetzt",
    "createPlace": "Platz erstellen",
    "mon": "Mo",
    "tue": "Di",
    "wed": "Mi",
    "thu": "Do",
    "fri": "Fr",
    "sat": "Sa",
    "sun": "So"
  },
  "time": {
    "title": "Zeiterfassung",
    "record": "Erfassen",
    "stopwatch": "Stoppuhr",
    "start": "Start",
    "stop": "Stop",
    "manual": "Manuell",
    "noRecords": "Keine Erfassungen",
    "category": "Kategorie",
    "comment": "Kommentar",
    "duration": "Dauer",
    "from": "Von",
    "to": "Bis"
  },
  "employees": {
    "title": "Mitarbeiter",
    "addNew": "Neue Mitarbeiter anlegen",
    "absences": "Abwesenheiten",
    "role": "Rolle",
    "owner": "Inhaber",
    "admin": "Admin",
    "manager": "Manager",
    "employee": "Mitarbeiter",
    "activate": "Freischalten",
    "deactivate": "Deaktivieren",
    "notActivated": "Zugang nicht freigeschaltet",
    "hours": "Stunden",
    "notes": "Notizen",
    "contact": "Kontakt"
  },
  "divisions": {
    "title": "Arbeitsbereiche",
    "createNew": "Neuen Arbeitsbereich erstellen",
    "assignEmployee": "Mitarbeiter zuweisen",
    "color": "Farbe",
    "systemDivision": "System-Bereich"
  },
  "portal": {
    "inbox": "Posteingang",
    "sent": "Gesendete",
    "trash": "Papierkorb",
    "files": "Dateien",
    "topics": "Themen",
    "noMessages": "Keine Nachrichten",
    "sendMessage": "Nachricht senden",
    "subject": "Betreff",
    "recipients": "Empfänger"
  },
  "reporting": {
    "title": "Auswertung",
    "totalHours": "Gesamtstunden",
    "perWeek": "Pro Woche",
    "export": "Export",
    "pdf": "PDF",
    "excel": "Excel",
    "csv": "CSV"
  },
  "settings": {
    "title": "Einstellungen",
    "schedule": "Schichtplan",
    "timeTracking": "Zeiterfassung",
    "wishPlans": "Wunschpläne",
    "employees": "Mitarbeiter",
    "absences": "Abwesenheiten",
    "account": "Account",
    "nameFormat": "Namensformat",
    "visibility": "Sichtbarkeit"
  },
  "ai": {
    "title": "KI-Assistent",
    "suggest": "KI-Vorschlag",
    "chat": "Chat",
    "insights": "Insights",
    "generating": "Wird generiert...",
    "accept": "Übernehmen",
    "decline": "Ablehnen",
    "askAnything": "Frag mich etwas..."
  }
}
```

**Step 6: Create English translations `messages/en.json`**

```json
{
  "nav": {
    "schedule": "Schedules",
    "time": "Time Tracking",
    "employees": "Employees",
    "divisions": "Departments",
    "portal": "Portal",
    "reporting": "Reports",
    "settings": "Settings",
    "ai": "AI Assistant"
  },
  "auth": {
    "login": "Sign In",
    "register": "Sign Up",
    "logout": "Sign Out",
    "email": "Email",
    "password": "Password",
    "firstName": "First Name",
    "lastName": "Last Name",
    "companyName": "Company Name",
    "invalidCredentials": "Invalid credentials",
    "alreadyRegistered": "Already registered?",
    "noAccount": "No account yet?"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "search": "Search",
    "filter": "Filter",
    "export": "Export",
    "loading": "Loading...",
    "noResults": "No results",
    "confirm": "Confirm",
    "back": "Back",
    "next": "Next",
    "all": "All",
    "active": "Active",
    "inactive": "Inactive"
  },
  "schedule": {
    "title": "Schedule",
    "createShift": "Create Shift",
    "editShift": "Edit Shift",
    "deleteShift": "Delete Shift",
    "bookEmployee": "Book Employee",
    "unbookEmployee": "Remove Employee",
    "allEmployees": "All Employees",
    "visibility": "Visibility",
    "setPublic": "Publish",
    "setPrivate": "Hide",
    "liveMode": "Live Mode",
    "startLive": "Start Live",
    "stopLive": "Stop Live",
    "briefing": "Briefing",
    "wishPlan": "Wish Plan",
    "options": "Options",
    "calendarWeek": "CW",
    "shiftFull": "Fully Staffed",
    "createPlace": "Create Slot",
    "mon": "Mon",
    "tue": "Tue",
    "wed": "Wed",
    "thu": "Thu",
    "fri": "Fri",
    "sat": "Sat",
    "sun": "Sun"
  },
  "time": {
    "title": "Time Tracking",
    "record": "Record",
    "stopwatch": "Stopwatch",
    "start": "Start",
    "stop": "Stop",
    "manual": "Manual",
    "noRecords": "No records",
    "category": "Category",
    "comment": "Comment",
    "duration": "Duration",
    "from": "From",
    "to": "To"
  },
  "employees": {
    "title": "Employees",
    "addNew": "Add New Employee",
    "absences": "Absences",
    "role": "Role",
    "owner": "Owner",
    "admin": "Admin",
    "manager": "Manager",
    "employee": "Employee",
    "activate": "Activate",
    "deactivate": "Deactivate",
    "notActivated": "Access not activated",
    "hours": "Hours",
    "notes": "Notes",
    "contact": "Contact"
  },
  "divisions": {
    "title": "Departments",
    "createNew": "Create New Department",
    "assignEmployee": "Assign Employee",
    "color": "Color",
    "systemDivision": "System Department"
  },
  "portal": {
    "inbox": "Inbox",
    "sent": "Sent",
    "trash": "Trash",
    "files": "Files",
    "topics": "Topics",
    "noMessages": "No messages",
    "sendMessage": "Send Message",
    "subject": "Subject",
    "recipients": "Recipients"
  },
  "reporting": {
    "title": "Reports",
    "totalHours": "Total Hours",
    "perWeek": "Per Week",
    "export": "Export",
    "pdf": "PDF",
    "excel": "Excel",
    "csv": "CSV"
  },
  "settings": {
    "title": "Settings",
    "schedule": "Schedule",
    "timeTracking": "Time Tracking",
    "wishPlans": "Wish Plans",
    "employees": "Employees",
    "absences": "Absences",
    "account": "Account",
    "nameFormat": "Name Format",
    "visibility": "Visibility"
  },
  "ai": {
    "title": "AI Assistant",
    "suggest": "AI Suggestion",
    "chat": "Chat",
    "insights": "Insights",
    "generating": "Generating...",
    "accept": "Accept",
    "decline": "Decline",
    "askAnything": "Ask me anything..."
  }
}
```

**Step 7: Commit**

```bash
git add src/i18n/ messages/ next.config.ts
git commit -m "feat: add i18n setup (next-intl, DE + EN translations)"
```

---

## Phase 2: Dashboard Layout & Shared Components

### Task 6: Dashboard Layout with Top Navigation

**Files:**
- Create: `src/app/[locale]/(dashboard)/layout.tsx`
- Create: `src/components/layout/top-nav.tsx`
- Create: `src/components/layout/user-menu.tsx`
- Create: `src/components/layout/mobile-nav.tsx`
- Create: `src/lib/hooks/use-current-member.ts`

**Step 1: Create org context helper `src/lib/hooks/use-current-member.ts`**

This hook fetches the current user's membership in the active organization.

```typescript
import { useQuery } from "@tanstack/react-query";

export type CurrentMember = {
  id: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "EMPLOYEE";
  organizationId: string;
  organizationName: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImage: string | null;
    locale: string;
  };
};

export function useCurrentMember() {
  return useQuery<CurrentMember>({
    queryKey: ["current-member"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      if (!res.ok) throw new Error("Failed to fetch member");
      return res.json();
    },
  });
}
```

**Step 2: Create API route `src/app/api/me/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: {
      organization: { select: { id: true, name: true } },
      user: {
        select: {
          id: true, firstName: true, lastName: true,
          email: true, profileImage: true, locale: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  if (!member) {
    return NextResponse.json({ error: "No membership found" }, { status: 404 });
  }

  return NextResponse.json({
    id: member.id,
    role: member.role,
    organizationId: member.organization.id,
    organizationName: member.organization.name,
    user: member.user,
  });
}
```

**Step 3: Create Top Navigation `src/components/layout/top-nav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CalendarDays, Clock, Users, Building2,
  MessageSquare, BarChart3, Settings, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";

const navItems = [
  { key: "schedule", href: "/schedule/flexible", icon: CalendarDays },
  { key: "time", href: "/time", icon: Clock },
  { key: "employees", href: "/employees", icon: Users },
  { key: "divisions", href: "/divisions", icon: Building2 },
  { key: "portal", href: "/portal/inbox", icon: MessageSquare },
  { key: "reporting", href: "/reporting", icon: BarChart3 },
  { key: "settings", href: "/settings", icon: Settings },
] as const;

export function TopNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-white dark:bg-slate-900">
      <div className="flex h-14 items-center px-4">
        {/* Logo */}
        <Link href="/schedule/flexible" className="mr-6 flex items-center gap-2 font-bold text-primary">
          <CalendarDays className="h-6 w-6" />
          <span className="hidden sm:inline">Schichtplaner</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const isActive = pathname.includes(item.href.split("/")[1]);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/ai/chat"
            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden lg:inline">{t("ai")}</span>
          </Link>
          <UserMenu />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
```

**Step 4: Create User Menu `src/components/layout/user-menu.tsx`**

```tsx
"use client";

import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { LogOut, Moon, Sun, Globe } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentMember } from "@/lib/hooks/use-current-member";
import { useTheme } from "next-themes";

export function UserMenu() {
  const t = useTranslations("auth");
  const { data: member } = useCurrentMember();
  const { theme, setTheme } = useTheme();

  const initials = member
    ? `${member.user.firstName[0]}${member.user.lastName[0]}`
    : "??";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium lg:inline">
          {member ? `${member.user.firstName} ${member.user.lastName}` : "..."}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {member && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {member.organizationName} ({member.role})
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="mr-2 h-4 w-4" />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 5: Create Mobile Nav `src/components/layout/mobile-nav.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, X, CalendarDays, Clock, Users, Building2, MessageSquare, BarChart3, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { key: "schedule", href: "/schedule/flexible", icon: CalendarDays },
  { key: "time", href: "/time", icon: Clock },
  { key: "employees", href: "/employees", icon: Users },
  { key: "divisions", href: "/divisions", icon: Building2 },
  { key: "portal", href: "/portal/inbox", icon: MessageSquare },
  { key: "reporting", href: "/reporting", icon: BarChart3 },
  { key: "settings", href: "/settings", icon: Settings },
] as const;

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex h-14 items-center border-b px-4 font-bold text-primary">
          <CalendarDays className="mr-2 h-5 w-5" />
          Schichtplaner
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {navItems.map((item) => {
            const isActive = pathname.includes(item.href.split("/")[1]);
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                <item.icon className="h-5 w-5" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 6: Create Dashboard Layout `src/app/[locale]/(dashboard)/layout.tsx`**

```tsx
import { TopNav } from "@/components/layout/top-nav";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { QueryProvider } from "@/components/providers/query-provider";
import { SessionProvider } from "next-auth/react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <QueryProvider>
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <TopNav />
            <main className="mx-auto max-w-[1400px] p-4 md:p-6">
              {children}
            </main>
          </div>
          <Toaster position="top-right" />
        </QueryProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
```

**Step 7: Create QueryProvider `src/components/providers/query-provider.tsx`**

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30 * 1000, retry: 1 },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

**Step 8: Install next-themes and sonner**

```bash
npm install next-themes
npx shadcn@latest add sonner
```

**Step 9: Commit**

```bash
git add src/components/ src/app/ src/lib/hooks/
git commit -m "feat: add dashboard layout with top navigation, user menu, mobile nav, dark mode"
```

---

## Phase 3: Employees & Divisions (CRUD)

### Task 7: Employees Module

**Files:**
- Create: `src/app/[locale]/(dashboard)/employees/page.tsx` (list view)
- Create: `src/app/[locale]/(dashboard)/employees/[id]/page.tsx` (detail view)
- Create: `src/app/api/employees/route.ts` (CRUD endpoints)
- Create: `src/components/employees/employee-list.tsx`
- Create: `src/components/employees/employee-form.tsx`
- Create: `src/components/employees/employee-detail.tsx`

**Summary:** Implement the full employee management module matching the original:
- Employee list with search, role filters (#alle, #admins, #manager, #nicht freigeschaltet, #inaktiv)
- Create new employees (single + bulk)
- Employee detail page with contact data, E-Dash (hours overview per month), notes
- Inline editing of employee data
- Role management (Admin/Manager/Employee)
- Activate/deactivate employees
- Profile image upload
- Password management
- Employee deletion with confirmation

**API endpoints to implement:**
- `GET /api/employees` — list all org members with filters
- `POST /api/employees` — create new employee(s)
- `GET /api/employees/[id]` — get employee details
- `PATCH /api/employees/[id]` — update employee data
- `DELETE /api/employees/[id]` — soft-delete employee
- `POST /api/employees/[id]/activate` — send activation email
- `PATCH /api/employees/[id]/role` — change role
- `POST /api/employees/[id]/image` — upload profile image
- `GET /api/employees/[id]/hours` — E-Dash monthly hours
- `POST /api/employees/[id]/notes` — CRUD notes

**Commit:** `feat: add employee management module (list, detail, CRUD, roles)`

---

### Task 8: Divisions Module

**Files:**
- Create: `src/app/[locale]/(dashboard)/divisions/page.tsx`
- Create: `src/app/api/divisions/route.ts`
- Create: `src/components/divisions/division-card.tsx`
- Create: `src/components/divisions/division-form.tsx`

**Summary:** Implement the divisions/departments module:
- Card-grid layout showing all divisions
- "Alle" system division (not editable/deletable)
- Create new division with name, description, color picker
- Edit/delete divisions
- Assign/unassign employees to divisions
- Employee filter by division
- Color-coded division badges

**API endpoints:**
- `GET /api/divisions` — list all
- `POST /api/divisions` — create
- `PATCH /api/divisions/[id]` — update
- `DELETE /api/divisions/[id]` — delete
- `POST /api/divisions/[id]/members` — assign employee
- `DELETE /api/divisions/[id]/members/[userId]` — unassign

**Commit:** `feat: add divisions module (CRUD, employee assignment, color coding)`

---

## Phase 4: Schedule (Core Feature)

### Task 9: Schedule Infrastructure

**Files:**
- Create: `src/app/[locale]/(dashboard)/schedule/flexible/[kw]/page.tsx`
- Create: `src/app/api/schedules/route.ts`
- Create: `src/lib/utils/calendar.ts` (KW helpers, date utils)
- Create: `src/components/schedule/week-nav.tsx` (KW navigation)

**Summary:** Build the schedule page skeleton:
- KW navigation bar (month buttons + KW dropdown, like original)
- Auto-create schedule record for a KW when first accessed
- URL pattern: `/schedule/flexible/{kw}_{year}` → `/schedule/flexible/09-2026`
- Calendar utility functions: getWeekDates(kw, year), getCurrentKW(), getMonthKWs()
- Schedule API: get-or-create schedule by KW+year

**Commit:** `feat: add schedule infrastructure (KW navigation, date utils, auto-create)`

---

### Task 10: Shift CRUD + Schedule Grid

**Files:**
- Create: `src/components/schedule/schedule-grid.tsx` (7-column grid)
- Create: `src/components/schedule/shift-card.tsx` (individual shift block)
- Create: `src/components/schedule/shift-form.tsx` (create/edit dialog)
- Create: `src/app/api/shifts/route.ts`

**Summary:** Implement the core schedule grid and shift management:
- 7-column responsive grid (Mo-So) with day headers showing date
- "+ Schicht" button per day column to create new shifts
- Shift card showing: time range, division color stripe, title, pause info, booking count (e.g. "1/3")
- Green badge when fully booked (schedule_shift_item_head_num_full)
- Today column highlight (#3b82f6)
- Shift create dialog: time from/to, division select, max employees, pause option, title, repeat days
- Shift edit/delete with confirmation

**API endpoints:**
- `GET /api/shifts?scheduleId=xxx` — list shifts for schedule
- `POST /api/shifts` — create shift(s)
- `PATCH /api/shifts/[id]` — update
- `DELETE /api/shifts/[id]` — delete

**Commit:** `feat: add schedule grid with shift CRUD (7-column layout, shift cards)`

---

### Task 11: Booking System (MA in Schichten eintragen)

**Files:**
- Create: `src/components/schedule/booking-slot.tsx`
- Create: `src/components/schedule/employee-picker.tsx` (searchable dropdown)
- Create: `src/app/api/bookings/route.ts`

**Summary:** Implement the employee booking system:
- Each shift shows booked employees as rows inside the card
- Empty slots with click-to-book functionality
- Employee picker dropdown (searchable, 425px wide like original)
- Book/unbook with click — booked employee shows name + X icon to remove
- "+ Platz erstellen" button to add more slots
- Drag & drop employees between shifts (dnd-kit)
- Employee side-nav showing all employees with total hours for the week

**API endpoints:**
- `POST /api/bookings` — book employee into shift
- `DELETE /api/bookings/[id]` — unbook
- `POST /api/shifts/[id]/places` — add empty place

**Commit:** `feat: add booking system (book/unbook employees, drag & drop, employee picker)`

---

### Task 12: Schedule Options (Visibility, Layout, Export, Filters)

**Files:**
- Create: `src/components/schedule/schedule-options.tsx`
- Create: `src/components/schedule/division-filter.tsx`
- Create: `src/components/schedule/schedule-visibility.tsx`

**Summary:**
- Division filter dropdown (filter shifts by area)
- Schedule visibility toggle (public/private for employees)
- Layout switch (Layout 1: box-shadow, Layout 2: border-left)
- Show/hide shift titles and pauses
- Briefing panel (create/edit/delete briefing text per KW)
- Absences sub-nav in employee panel

**Commit:** `feat: add schedule options (filters, visibility, layout, briefing)`

---

## Phase 5: Time Tracking

### Task 13: Time Tracking Module

**Files:**
- Create: `src/app/[locale]/(dashboard)/time/page.tsx`
- Create: `src/app/api/time/route.ts`
- Create: `src/components/time/time-list.tsx`
- Create: `src/components/time/time-record-form.tsx`
- Create: `src/components/time/stopwatch.tsx`
- Create: `src/components/time/time-settings.tsx`

**Summary:** Full time tracking implementation:
- Monthly view with employee list (expandable per employee)
- Manual time recording: select employee(s), select day(s), enter from/to or duration
- Digital stopwatch (start/stop with timer display)
- Categories (optional, configurable)
- Edit/delete existing records with history log
- Month navigation (previous/next)
- Employee search
- Hours badges per employee (total for month)
- Settings: who can track, auto-stop, warnings, categories

**API endpoints:**
- `GET /api/time?month=2026-03` — list records for month
- `POST /api/time` — create manual record
- `PATCH /api/time/[id]` — edit record
- `DELETE /api/time/[id]` — delete record
- `POST /api/time/watch/start` — start stopwatch
- `POST /api/time/watch/stop` — stop stopwatch
- `GET /api/time/categories` — list categories
- `POST /api/time/categories` — CRUD categories
- `GET /api/time/settings` — get settings
- `PATCH /api/time/settings` — update settings

**Commit:** `feat: add time tracking module (manual, stopwatch, categories, settings)`

---

### Task 14: Absence Management

**Files:**
- Create: `src/components/employees/absence-calendar.tsx`
- Create: `src/app/api/absences/route.ts`

**Summary:**
- Yearly calendar view showing absences
- Absence categories with colors (vacation, sick, custom)
- Request/approve/decline workflow
- Holiday awareness (DE/AT/CH by Bundesland)
- Integration with schedule (show absences in employee nav)

**Commit:** `feat: add absence management (calendar, categories, approval workflow)`

---

## Phase 6: Portal & Communication

### Task 15: Messages Module

**Files:**
- Create: `src/app/[locale]/(dashboard)/portal/inbox/page.tsx`
- Create: `src/app/[locale]/(dashboard)/portal/sent/page.tsx`
- Create: `src/app/[locale]/(dashboard)/portal/trash/page.tsx`
- Create: `src/app/api/messages/route.ts`
- Create: `src/components/portal/message-list.tsx`
- Create: `src/components/portal/compose-message.tsx`
- Create: `src/components/portal/portal-sidebar.tsx`

**Summary:** Internal messaging system:
- Sidebar layout (like original: inbox, sent, trash, files, topics)
- Compose message: recipient picker (single/group), subject, body
- Inbox with read/unread badges
- Message detail view with reply functionality
- Trash with restore
- Unread count in navigation badge

**Commit:** `feat: add portal messaging (inbox, sent, trash, compose, replies)`

---

### Task 16: Files & Topics Module

**Files:**
- Create: `src/app/[locale]/(dashboard)/portal/files/page.tsx`
- Create: `src/app/[locale]/(dashboard)/portal/topics/page.tsx`
- Create: `src/app/api/files/route.ts`
- Create: `src/app/api/topics/route.ts`

**Summary:**
- File management: folders (nested), upload, download, rename, move, delete
- File upload to MinIO via presigned URLs
- Topics: forum-like discussions, create topic, post replies
- File send to employees

**Commit:** `feat: add portal files (upload/folders) and topics (forum)`

---

## Phase 7: Reporting & Export

### Task 17: Reporting/Auswertung Module

**Files:**
- Create: `src/app/[locale]/(dashboard)/reporting/[month]/page.tsx`
- Create: `src/app/api/reporting/route.ts`
- Create: `src/components/reporting/hours-table.tsx`
- Create: `src/components/reporting/export-modal.tsx`

**Summary:** Reporting page matching original layout:
- Monthly overview with total hours and shift count
- KW breakdown with per-employee hours (table with KW columns)
- Click on cell to see detail / edit hours
- Employee search
- Branch switcher (if multi-branch)
- Export modal with format selection (PDF/Excel/CSV/HTML)
- Month/year navigation

**API endpoints:**
- `GET /api/reporting?month=maerz_2026` — monthly report data
- `GET /api/reporting/export/pdf` — PDF generation
- `GET /api/reporting/export/excel` — Excel generation
- `GET /api/reporting/export/csv` — CSV generation

**Commit:** `feat: add reporting module (monthly hours table, KW breakdown, export)`

---

## Phase 8: Settings

### Task 18: Settings Module

**Files:**
- Create: `src/app/[locale]/(dashboard)/settings/page.tsx`
- Create: `src/app/api/settings/route.ts`
- Create: `src/components/settings/settings-sidebar.tsx`
- Create: `src/components/settings/schedule-settings.tsx`
- Create: `src/components/settings/time-settings.tsx`
- Create: `src/components/settings/employee-settings.tsx`
- Create: `src/components/settings/absence-settings.tsx`
- Create: `src/components/settings/account-settings.tsx`

**Summary:** All settings sub-pages (matching original sidebar):
- Schedule: name format, MA visibility
- Time tracking: who can track, auto-stop, warnings, categories
- Wish plans: enable/disable, deadline settings
- Employees: login permissions, data editing rights
- Absences: categories CRUD (name, color, paid), holiday location (country/state)
- Account: company info, delete account
- AVV (Auftragsverarbeitungsvertrag)

**Commit:** `feat: add settings module (all sub-sections, org configuration)`

---

## Phase 9: Realtime (WebSockets)

### Task 19: Socket.io Integration

**Files:**
- Modify: `server.ts` (extend socket events)
- Create: `src/lib/socket.ts` (client-side hook)
- Create: `src/lib/emit.ts` (server-side emit helper)

**Summary:**
- Client-side `useSocket()` hook with auto-join org room
- Server-side `emitToOrg(orgId, event, data)` helper
- Integrate into schedule: live updates on shift CRUD, booking changes
- Integrate into time tracking: stopwatch sync
- Integrate into messages: new message notifications
- Integrate into live mode: real-time booking feed
- Connection status indicator in nav
- Automatic reconnect + polling fallback

**Commit:** `feat: add Socket.io realtime integration (org rooms, live events, fallback)`

---

### Task 20: Live Mode

**Files:**
- Create: `src/components/schedule/live-mode.tsx`
- Create: `src/app/api/live/route.ts`

**Summary:** Full live mode matching original:
- Start/stop live mode (pulsing purple indicator)
- Day enable/disable toggles
- Employees can self-book into open shifts
- Real-time polling (1.5-2.6s via Socket.io)
- Live log showing book/unbook events
- Auto-stop with deadline timer
- Settings: allow exceeds, book requests

**Commit:** `feat: add live mode (self-booking, realtime log, day controls)`

---

## Phase 10: KI Features

### Task 21: AI Infrastructure

**Files:**
- Create: `src/lib/ai/client.ts` (Claude API wrapper)
- Create: `src/lib/ai/rate-limiter.ts`
- Create: `src/app/api/ai/route.ts`

**Summary:**
- Claude API client singleton with Anthropic SDK
- Rate limiter per organization (configurable)
- Response caching for identical inputs (Redis)
- AI settings check (is feature enabled for this org?)

**Commit:** `feat: add AI infrastructure (Claude client, rate limiting, caching)`

---

### Task 22: AI Auto-Planner

**Files:**
- Create: `src/lib/ai/auto-planner.ts`
- Create: `src/components/schedule/ai-suggest-button.tsx`
- Create: `src/components/schedule/ai-suggestion-overlay.tsx`
- Create: `src/app/api/ai/suggest-schedule/route.ts`

**Summary:**
- "KI-Vorschlag" button in schedule toolbar
- Collects context: employees, divisions, absences, hours limits, previous schedules
- Sends structured prompt to Claude with constraints
- Claude returns shift assignments as JSON
- Renders as semi-transparent overlay cards on schedule
- Accept individual suggestions or accept all
- Decline to dismiss

**Commit:** `feat: add AI auto-planner (schedule suggestions with accept/decline)`

---

### Task 23: AI Employee Recommendation

**Files:**
- Create: `src/lib/ai/employee-recommender.ts`
- Modify: `src/components/schedule/employee-picker.tsx` (add scores)

**Summary:**
- Rule-based scoring (no LLM needed):
  - Hours balance: who has fewer hours this week? (+40 points)
  - Availability: no absence, no overlapping shift (+30 points)
  - Division match: employee belongs to shift's division (+20 points)
  - Historical preference: employee often works this time slot (+10 points)
- Sort employee picker by score, show badge (0-100)
- Green/yellow/red indicators

**Commit:** `feat: add intelligent employee recommendation (scoring, sorted picker)`

---

### Task 24: AI Anomaly Detection

**Files:**
- Create: `src/lib/ai/anomaly-detector.ts`
- Create: `src/components/time/anomaly-badge.tsx`
- Create: `src/app/api/ai/anomalies/route.ts`

**Summary:**
- Runs on time records to detect:
  - Shifts > configurable max hours (default 10h)
  - Days without records for active employees
  - Overlapping time records
  - Significant deviation from planned schedule
- Yellow/red badges on time tracking page
- Click badge for detail explanation

**Commit:** `feat: add AI anomaly detection (time tracking warnings)`

---

### Task 25: AI NLP Chat

**Files:**
- Create: `src/app/[locale]/(dashboard)/ai/chat/page.tsx`
- Create: `src/components/ai/chat-widget.tsx` (floating button + panel)
- Create: `src/components/ai/chat-messages.tsx`
- Create: `src/lib/ai/chat-tools.ts` (tool definitions for Claude)
- Create: `src/app/api/ai/chat/route.ts`

**Summary:**
- Floating chat button (bottom-right, purple sparkle)
- Expandable chat panel with message history
- Claude with tool-use pattern:
  - Tools: createShift, bookEmployee, getSchedule, getEmployeeHours, searchEmployees, etc.
  - Confirmation step before destructive actions
- Supports DE and EN based on user locale
- Example queries: "Erstelle den gleichen Plan wie letzte Woche", "Wer hat die meisten Stunden?"

**Commit:** `feat: add AI NLP chat (floating widget, Claude tool-use, DE/EN)`

---

### Task 26: AI Forecasting & Smart Briefing

**Files:**
- Create: `src/app/[locale]/(dashboard)/ai/insights/page.tsx`
- Create: `src/components/ai/forecast-chart.tsx`
- Create: `src/lib/ai/forecast.ts`
- Create: `src/lib/ai/briefing-generator.ts`
- Create: `src/app/api/ai/forecast/route.ts`
- Create: `src/app/api/ai/briefing/route.ts`

**Summary:**
- **Forecast:** Trend chart (Recharts) showing hours/week for last 3 months + prediction
  - Moving average + seasonal detection
  - Claude generates natural language summary
- **Smart Briefing:** "KI-Briefing" button when creating briefings
  - Claude analyzes current schedule → generates briefing text
  - Admin edits before publishing

**Commit:** `feat: add AI forecasting dashboard and smart briefing generator`

---

## Phase 11: Additional Views & Polish

### Task 27: Additional Schedule Views

**Files:**
- Create: `src/app/[locale]/(dashboard)/schedule/classic/[kw]/page.tsx`
- Create: `src/app/[locale]/(dashboard)/schedule/employee/[kw]/page.tsx`
- Create: `src/app/[locale]/(dashboard)/schedule/month/[month]/page.tsx`

**Summary:** Three additional views from the original:
- **Classic:** Original table-style layout
- **Employee:** One row per employee across all days
- **Monthly:** Full month overview instead of weekly
- View switcher tabs in schedule header

**Commit:** `feat: add classic, employee, and monthly schedule views`

---

### Task 28: Wish Plan (Wunschpläne)

**Files:**
- Create: `src/components/schedule/wish-plan.tsx`
- Create: `src/app/api/mod-requests/route.ts`

**Summary:**
- Employees can send wish requests for specific shifts
- Admin sees wish requests as badges on shifts
- Accept/decline individual requests
- Filter view: show only shifts with open requests
- Wish plan settings in settings module

**Commit:** `feat: add wish plan system (requests, approval, filtering)`

---

### Task 29: Docker Production Setup

**Files:**
- Modify: `docker-compose.yml` (add app service, Caddy)
- Create: `Caddyfile`

**Summary:**
- Add `app` service to docker-compose (build from Dockerfile)
- Add Caddy reverse proxy with automatic HTTPS
- WebSocket proxy configuration
- MinIO bucket auto-creation
- Health checks on all services
- Production environment variables

**Commit:** `feat: add production Docker setup with Caddy reverse proxy`

---

### Task 30: Seed Data & Final Polish

**Files:**
- Create: `prisma/seed.ts`
- Create: `src/app/[locale]/(dashboard)/schedule/flexible/page.tsx` (redirect to current KW)

**Summary:**
- Seed script: demo company, 10 employees, 2 divisions, sample schedule
- Default redirect: `/schedule/flexible` → current KW
- Loading skeletons on all pages
- Error boundaries
- 404 page
- Favicon + meta tags
- Final responsive testing

**Commit:** `feat: add seed data, loading states, error handling, final polish`

---

## Implementation Order Summary

```
Phase 1 (Infrastructure):    Tasks 1-5   → Project, Docker, DB, Auth, i18n
Phase 2 (Layout):            Task 6      → Dashboard, Nav, Dark Mode
Phase 3 (People):            Tasks 7-8   → Employees, Divisions
Phase 4 (Core):              Tasks 9-12  → Schedule Grid, Shifts, Bookings, Options
Phase 5 (Time):              Tasks 13-14 → Time Tracking, Absences
Phase 6 (Communication):     Tasks 15-16 → Messages, Files, Topics
Phase 7 (Analytics):         Task 17     → Reporting + Export
Phase 8 (Config):            Task 18     → Settings
Phase 9 (Realtime):          Tasks 19-20 → Socket.io, Live Mode
Phase 10 (AI):               Tasks 21-26 → AI infra, Planner, Chat, Forecast
Phase 11 (Polish):           Tasks 27-30 → Extra views, Wish Plans, Docker, Seed
```

Total: **30 Tasks across 11 Phases**

Each phase builds on the previous one. Phase 1-4 are the critical path — once those work, you have a usable shift planner. Everything after is additive.
