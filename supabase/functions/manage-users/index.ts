import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StaffRow {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create a service-role client to perform admin actions
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create an anon client to verify the caller's session and role
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const callerClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData.user) {
      return jsonError("Unauthorized", 401);
    }

    const { data: callerStaff, error: staffErr } = await adminClient
      .from("staff")
      .select("role, is_active")
      .eq("id", callerData.user.id)
      .maybeSingle();

    if (staffErr || !callerStaff) {
      return jsonError("Staff record not found", 403);
    }
    if (callerStaff.role !== "administrator") {
      return jsonError("Administrator access required", 403);
    }
    if (!callerStaff.is_active) {
      return jsonError("Account inactive", 403);
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    // GET: list all staff with their emails
    if (req.method === "GET" && action === "list") {
      const { data: staffList, error: listErr } = await adminClient
        .from("staff")
        .select("*")
        .order("created_at", { ascending: true });
      if (listErr) return jsonError(listErr.message, 500);

      const staffRows = (staffList || []) as StaffRow[];
      const userIds = staffRows.map((s) => s.id);
      const { data: users, error: usersErr } = await adminClient.auth.admin.listUsers();
      let emailMap = new Map<string, string>();
      if (!usersErr && users) {
        for (const u of users.users) {
          emailMap.set(u.id, u.email || "");
        }
      }

      const result = staffRows.map((s) => ({
        id: s.id,
        full_name: s.full_name,
        role: s.role,
        is_active: s.is_active,
        created_at: s.created_at,
        email: emailMap.get(s.id) || "",
      }));

      return jsonResponse({ users: result });
    }

    // POST: create a new user
    if (req.method === "POST" && action === "create") {
      const body = await req.json();
      const { email, password, full_name, role } = body;
      if (!email || !password || !full_name || !role) {
        return jsonError("Missing required fields", 400);
      }
      if (!["administrator", "cashier", "receptionist", "accountant"].includes(role)) {
        return jsonError("Invalid role", 400);
      }
      if (password.length < 6) {
        return jsonError("Password must be at least 6 characters", 400);
      }

      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr) return jsonError(createErr.message, 400);
      if (!newUser.user) return jsonError("Failed to create user", 500);

      // Upsert staff row (the handle_new_user trigger may have already created one)
      const { error: upsertErr } = await adminClient
        .from("staff")
        .upsert(
          { id: newUser.user.id, full_name, role, is_active: true },
          { onConflict: "id" }
        );
      if (upsertErr) return jsonError(upsertErr.message, 500);

      return jsonResponse({ id: newUser.user.id, email, full_name, role });
    }

    // PUT: update a user's role / active status / name
    if (req.method === "PUT" && action === "update") {
      const body = await req.json();
      const { id, role, is_active, full_name } = body;
      if (!id) return jsonError("Missing user id", 400);

      const patch: Record<string, unknown> = {};
      if (role !== undefined) {
        if (!["administrator", "cashier", "receptionist", "accountant"].includes(role)) {
          return jsonError("Invalid role", 400);
        }
        patch.role = role;
      }
      if (is_active !== undefined) patch.is_active = is_active;
      if (full_name !== undefined) patch.full_name = full_name;

      const { error: updateErr } = await adminClient
        .from("staff")
        .update(patch)
        .eq("id", id);
      if (updateErr) return jsonError(updateErr.message, 500);

      return jsonResponse({ ok: true });
    }

    // DELETE: remove a user
    if (req.method === "DELETE" && action === "delete") {
      const body = await req.json();
      const { id } = body;
      if (!id) return jsonError("Missing user id", 400);
      if (id === callerData.user.id) return jsonError("Cannot delete your own account", 400);

      const { error: delErr } = await adminClient.auth.admin.deleteUser(id);
      if (delErr) return jsonError(delErr.message, 500);

      return jsonResponse({ ok: true });
    }

    return jsonError("Not found", 404);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return jsonError(msg, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
