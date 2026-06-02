#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const VALID_ARGS = new Set(["--commit", "--help", "-h"]);
const args = process.argv.slice(2);
const unknownArgs = args.filter((arg) => !VALID_ARGS.has(arg));
const shouldCommit = args.includes("--commit");
const wantsHelp = args.includes("--help") || args.includes("-h");

const REQUIRED_FIXTURES = [
  {
    prefix: "E2E_MEMBER",
    role: "member",
    fullName: "E2E Member",
    employeeId: "E2E-MEMBER",
  },
  {
    prefix: "E2E_DEPARTMENT_ADMIN",
    aliases: ["E2E_ADMIN"],
    role: "department_admin",
    fullName: "E2E Department Admin",
    employeeId: "E2E-DEPARTMENT-ADMIN",
  },
  {
    prefix: "E2E_HR_ADMIN",
    role: "hr_admin",
    fullName: "E2E HR Admin",
    employeeId: "E2E-HR-ADMIN",
  },
  {
    prefix: "E2E_SUPER_ADMIN",
    role: "super_admin",
    fullName: "E2E Super Admin",
    employeeId: "E2E-SUPER-ADMIN",
  },
];

const OPTIONAL_FIXTURES = [
  {
    prefix: "E2E_UNRELATED",
    role: "member",
    fullName: "E2E Unrelated Member",
    employeeId: "E2E-UNRELATED",
  },
];

const PROFILE_SELECT = [
  "id",
  "email",
  "full_name",
  "employee_id",
  "company_id",
  "department_id",
  "role",
  "validation_status",
  "validated_at",
  "validation_notes",
  "is_admin",
  "onboarding_completed_at",
].join(",");

function usage() {
  console.log("ShiftSwap local E2E auth fixture");
  console.log("");
  console.log("Usage:");
  console.log("  npm run supabase:setup:e2e-auth");
  console.log("  npm run supabase:setup:e2e-auth:commit");
  console.log("");
  console.log("Default mode is dry-run/ROLLBACK. Pass --commit to persist local changes.");
}

function readEnvFile() {
  const envPath = join(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return new Map();
  }

  const values = new Map();
  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match) {
      continue;
    }

    const [, name, rawValue] = match;
    let value = rawValue.trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (value) {
      values.set(name, value);
    }
  }

  return values;
}

const envFileValues = readEnvFile();

function readEnv(name) {
  const processValue = process.env[name]?.trim();
  if (processValue) {
    return processValue;
  }

  const fileValue = envFileValues.get(name)?.trim();
  return fileValue || null;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isLocalSupabaseUrl(rawUrl) {
  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  return (
    parsed.protocol === "http:" &&
    ["127.0.0.1", "localhost", "0.0.0.0", "::1"].includes(parsed.hostname)
  );
}

function maskEmail(email) {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return "(configured)";
  }

  const first = localPart.slice(0, 1);
  return `${first}***@${domain}`;
}

function readCredentialPair(prefix) {
  const email = readEnv(`${prefix}_EMAIL`);
  const password = readEnv(`${prefix}_PASSWORD`);

  if (!email && !password) {
    return null;
  }

  return { email, password };
}

function readFixtureConfig(definition) {
  const prefixes = [definition.prefix, ...(definition.aliases ?? [])];

  for (const prefix of prefixes) {
    const credentials = readCredentialPair(prefix);

    if (!credentials) {
      continue;
    }

    return {
      ...definition,
      activePrefix: prefix,
      email: credentials.email,
      password: credentials.password,
    };
  }

  return {
    ...definition,
    activePrefix: definition.prefix,
    email: null,
    password: null,
  };
}

function validateFixtureConfig(config, required) {
  const missing = [];

  if (!config.email) {
    missing.push(`${config.activePrefix}_EMAIL`);
  }

  if (!config.password) {
    missing.push(`${config.activePrefix}_PASSWORD`);
  }

  if (missing.length > 0) {
    return required
      ? `Missing required E2E credential(s): ${missing.join(", ")}`
      : `Skipping optional ${config.prefix}: missing ${missing.join(", ")}`;
  }

  if (config.password.length < 6) {
    return `${config.activePrefix}_PASSWORD must be at least 6 characters for Supabase Auth.`;
  }

  return null;
}

async function findAuthUserByEmail(supabase, email) {
  const normalizedEmail = email.toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Could not list local auth users: ${error.message}`);
    }

    const users = data?.users ?? [];
    const match = users.find(
      (user) => user.email?.toLowerCase() === normalizedEmail
    );

    if (match) {
      return match;
    }

    if (users.length < perPage) {
      return null;
    }
  }

  throw new Error("Could not scan local auth users: pagination limit exceeded.");
}

async function ensureAuthUser(supabase, config) {
  const existingUser = await findAuthUserByEmail(supabase, config.email);

  if (!shouldCommit) {
    return {
      action: existingUser ? "repair-auth" : "create-auth",
      user: existingUser,
    };
  }

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      {
        password: config.password,
        email_confirm: true,
        user_metadata: {
          ...(existingUser.user_metadata ?? {}),
          full_name: config.fullName,
          e2e_fixture: true,
          e2e_role: config.role,
        },
        app_metadata: {
          ...(existingUser.app_metadata ?? {}),
          e2e_fixture: true,
        },
      }
    );

    if (error) {
      throw new Error(`Could not repair auth user for ${config.prefix}: ${error.message}`);
    }

    return { action: "repair-auth", user: data.user };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: config.email,
    password: config.password,
    email_confirm: true,
    user_metadata: {
      full_name: config.fullName,
      e2e_fixture: true,
      e2e_role: config.role,
    },
    app_metadata: {
      e2e_fixture: true,
    },
  });

  if (error) {
    throw new Error(`Could not create auth user for ${config.prefix}: ${error.message}`);
  }

  return { action: "create-auth", user: data.user };
}

async function getProfile(supabase, userId) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load user_profiles row: ${error.message}`);
  }

  return data;
}

function buildProfilePayload(config, userId, scope, existingProfile, now) {
  const isSuperAdmin = config.role === "super_admin";

  return {
    id: userId,
    email: config.email,
    full_name: config.fullName,
    employee_id: config.employeeId,
    role: config.role,
    company_id: isSuperAdmin ? null : scope.company.id,
    department_id: isSuperAdmin ? null : scope.department.id,
    validation_status: "approved",
    validated_at: existingProfile?.validated_at ?? now,
    validation_notes: `Local E2E fixture (${config.prefix})`,
    is_admin: config.role !== "member",
    onboarding_completed_at: existingProfile?.onboarding_completed_at ?? now,
  };
}

function changedProfileFields(existingProfile, payload) {
  if (!existingProfile) {
    return ["create"];
  }

  const stableFields = [
    "email",
    "full_name",
    "employee_id",
    "role",
    "company_id",
    "department_id",
    "validation_status",
    "validation_notes",
    "is_admin",
  ];

  const changed = stableFields.filter(
    (field) => existingProfile[field] !== payload[field]
  );

  if (!existingProfile.onboarding_completed_at) {
    changed.push("onboarding_completed_at");
  }

  if (!existingProfile.validated_at) {
    changed.push("validated_at");
  }

  return changed;
}

async function ensureProfile(supabase, config, authUser, scope, now) {
  if (!authUser?.id) {
    return {
      action: "create-profile",
      changedFields: ["create"],
    };
  }

  const existingProfile = await getProfile(supabase, authUser.id);
  const payload = buildProfilePayload(config, authUser.id, scope, existingProfile, now);
  const changedFields = changedProfileFields(existingProfile, payload);

  if (!shouldCommit) {
    return {
      action: existingProfile ? "repair-profile" : "create-profile",
      changedFields,
    };
  }

  const { error } = await supabase
    .from("user_profiles")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    throw new Error(`Could not upsert user_profiles row for ${config.prefix}: ${error.message}`);
  }

  return {
    action: existingProfile ? "repair-profile" : "create-profile",
    changedFields,
  };
}

async function loadSeedScope(supabase) {
  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id,name,slug")
    .in("slug", ["arcelor", "empresa-demo"]);

  if (companiesError) {
    throw new Error(`Could not load seed companies: ${companiesError.message}`);
  }

  const company =
    (companies ?? []).find((candidate) => candidate.slug === "arcelor") ??
    (companies ?? []).find((candidate) => candidate.slug === "empresa-demo");

  if (!company) {
    throw new Error(
      "No seed company found. Apply local migrations/seeds first; expected slug 'arcelor' or 'empresa-demo'."
    );
  }

  const { data: departments, error: departmentsError } = await supabase
    .from("departments")
    .select("id,name,company_id,parent_department_id,is_assignable")
    .eq("company_id", company.id)
    .eq("is_assignable", true)
    .order("name", { ascending: true });

  if (departmentsError) {
    throw new Error(
      `Could not load seed departments: ${departmentsError.message}. Apply migrations through department scope support and rerun seeds.`
    );
  }

  const department = (departments ?? [])[0] ?? null;

  if (!department) {
    throw new Error(
      `No assignable seed department found for company '${company.slug}'. Run the local seeds before setting up E2E auth.`
    );
  }

  return { company, department };
}

async function resetLocalAuthRateLimitBuckets(supabase) {
  if (!shouldCommit) {
    return;
  }

  const { error } = await supabase
    .from("request_rate_limits")
    .delete()
    .in("scope", ["auth_login_email", "auth_login_ip"]);

  if (error) {
    throw new Error(`Could not reset local auth rate limits: ${error.message}`);
  }

  console.log("Local auth login rate-limit buckets reset for E2E smoke.");
}

async function main() {
  if (wantsHelp) {
    usage();
    process.exit(0);
  }

  if (unknownArgs.length > 0) {
    usage();
    fail(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  }

  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL in process env or .env.local.");
  }

  if (!isLocalSupabaseUrl(supabaseUrl)) {
    fail(
      "Blocked: NEXT_PUBLIC_SUPABASE_URL must point to local Supabase (http://127.0.0.1, localhost, 0.0.0.0, or ::1)."
    );
  }

  if (!serviceRoleKey) {
    fail("Missing SUPABASE_SERVICE_ROLE_KEY in process env or .env.local.");
  }

  const requiredConfigs = REQUIRED_FIXTURES.map(readFixtureConfig);
  const optionalConfigs = OPTIONAL_FIXTURES.map(readFixtureConfig);
  const requiredErrors = requiredConfigs
    .map((config) => validateFixtureConfig(config, true))
    .filter(Boolean);

  if (requiredErrors.length > 0) {
    console.error("E2E auth fixture is not configured.");
    requiredErrors.forEach((error) => console.error(`- ${error}`));
    console.error("");
    console.error("Fill these values in .env.local, then rerun the dry-run:");
    REQUIRED_FIXTURES.forEach((fixture) => {
      console.error(`- ${fixture.prefix}_EMAIL`);
      console.error(`- ${fixture.prefix}_PASSWORD`);
    });
    process.exit(1);
  }

  const runnableOptionalConfigs = [];
  for (const config of optionalConfigs) {
    const warning = validateFixtureConfig(config, false);

    if (warning) {
      console.log(warning);
      continue;
    }

    runnableOptionalConfigs.push(config);
  }

  const configs = [...requiredConfigs, ...runnableOptionalConfigs];
  const modeLabel = shouldCommit ? "COMMIT" : "dry-run / ROLLBACK";

  console.log("ShiftSwap local E2E auth fixture");
  console.log(`Mode: ${modeLabel}`);
  console.log(
    shouldCommit
      ? "Local Auth users and user_profiles rows will be created/repaired."
      : "No writes will be persisted. Pass --commit to create/repair local users."
  );
  console.log("");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const scope = await loadSeedScope(supabase);
  console.log(
    `Using seed scope: company='${scope.company.slug}', department='${scope.department.name}'.`
  );
  console.log("");

  const now = new Date().toISOString();

  for (const config of configs) {
    let authResult;
    let profileResult;

    try {
      authResult = await ensureAuthUser(supabase, config);
      profileResult = await ensureProfile(
        supabase,
        config,
        authResult.user,
        scope,
        now
      );
    } catch (error) {
      if (shouldCommit && authResult?.action === "create-auth" && authResult.user?.id) {
        await supabase.auth.admin.deleteUser(authResult.user.id);
      }

      throw error;
    }

    const profileSummary =
      profileResult.changedFields.length === 0
        ? "profile-ok"
        : `${profileResult.action}(${profileResult.changedFields.join(",")})`;

    console.log(
      [
        config.prefix,
        `role=${config.role}`,
        `email=${maskEmail(config.email)}`,
        authResult.action,
        profileSummary,
      ].join(" | ")
    );
  }

  await resetLocalAuthRateLimitBuckets(supabase);

  console.log("");
  console.log(
    shouldCommit
      ? "COMMIT complete. Local E2E auth users are ready."
      : "ROLLBACK complete. No local E2E auth changes were persisted."
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
