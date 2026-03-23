// Supabase client for Next.js Middleware (session refresh)
// Used in middleware.ts at the project root

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasAdminPanelAccess } from '@/lib/user-roles';
import type { UserRole, ValidationStatus } from '@/types';

function clearSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse
) {
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.startsWith('sb-')) continue;

    request.cookies.delete(cookie.name);
    response.cookies.delete(cookie.name);
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage =
    pathname.startsWith('/login') || pathname.startsWith('/register');
  const isPendingValidationPage = pathname.startsWith('/pending-validation');
  const isAuthApiRoute = pathname.startsWith('/api/auth');

  if (authError) {
    const shouldClearSession =
      authError.message.includes('Refresh Token') ||
      authError.message.includes('refresh token') ||
      authError.message.includes('JWT');

    if (shouldClearSession) {
      clearSupabaseAuthCookies(request, supabaseResponse);
    }

    if (!isAuthPage && !isAuthApiRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  if (!user && !isAuthPage && !isAuthApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (!user) {
    return supabaseResponse;
  }

  const { data: rawAccountState } = await supabase
    .from('user_profiles')
    .select('validation_status, role')
    .eq('id', user.id)
    .maybeSingle();

  const accountState = rawAccountState as
    | {
        validation_status: ValidationStatus;
        role: UserRole;
      }
    | null;
  const validationStatus = accountState?.validation_status ?? null;
  const role = accountState?.role ?? 'member';
  const isBlockedByValidation =
    validationStatus === 'pending' || validationStatus === 'rejected';

  if (isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = isBlockedByValidation ? '/pending-validation' : '/shifts';
    return NextResponse.redirect(url);
  }

  if (isBlockedByValidation && !isPendingValidationPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/pending-validation';
    return NextResponse.redirect(url);
  }

  if (!isBlockedByValidation && isPendingValidationPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/shifts';
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/admin') && !hasAdminPanelAccess(role)) {
    const url = request.nextUrl.clone();
    url.pathname = '/shifts';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
