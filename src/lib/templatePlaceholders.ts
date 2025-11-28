import { US_STATES } from "@/lib/constants";

interface PostContext {
  title?: string | null;
  state_code?: string | null;
  county_name?: string | null;
  pay_type?: "fixed" | "range" | null;
  pay_min?: number | null;
  pay_max?: number | null;
}

interface ProfileContext {
  // Rep-related
  rep_anonymous_id?: string | null;
  rep_full_name?: string | null;
  rep_city?: string | null;
  rep_state?: string | null;
  rep_systems?: string[] | null;
  rep_inspection_types?: string[] | null;

  // Vendor-related
  vendor_anonymous_id?: string | null;
  vendor_company_name?: string | null;
  vendor_full_name?: string | null;
  vendor_city?: string | null;
  vendor_state?: string | null;
  vendor_systems?: string[] | null;
  vendor_inspection_types?: string[] | null;
}

export interface TemplateContext {
  post?: PostContext;
  profile?: ProfileContext;
}

export function renderTemplateBody(raw: string, ctx: TemplateContext): string {
  if (!raw) return "";

  const today = new Date();
  const todayString = today.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const stateName =
    ctx.post?.state_code &&
    US_STATES.find(s => s.value === ctx.post!.state_code)?.label;

  let postRate = "";
  const payMin = ctx.post?.pay_min ?? null;
  const payMax = ctx.post?.pay_max ?? null;
  const payType = ctx.post?.pay_type ?? null;

  if (payType === "fixed" && payMin !== null) {
    postRate = `$${payMin.toFixed(2)} / order`;
  } else if (payType === "range" && payMin !== null && payMax !== null) {
    postRate = `$${payMin.toFixed(2)} – $${payMax.toFixed(2)} / order`;
  }

  const repFirstName = ctx.profile?.rep_full_name?.split(" ")[0] ?? "";
  const repLastInitial = ctx.profile?.rep_full_name
    ? ctx.profile.rep_full_name.split(" ").slice(-1)[0]?.charAt(0) ?? ""
    : "";

  const vendorContactFirstName = ctx.profile?.vendor_company_name
    ? ctx.profile.vendor_company_name.split(" ")[0]
    : ctx.profile?.vendor_full_name?.split(" ")[0] ?? "there";

  const replacements: Record<string, string> = {
    POST_TITLE: ctx.post?.title ?? "",
    POST_STATE_CODE: ctx.post?.state_code ?? "",
    POST_STATE_NAME: stateName ?? "",
    POST_COUNTY: ctx.post?.county_name ?? "",
    POST_RATE: postRate,
    POST_PAY_MIN: payMin !== null ? `$${payMin.toFixed(2)}` : "",
    POST_PAY_MAX: payMax !== null ? `$${payMax.toFixed(2)}` : "",

    REP_ANON: ctx.profile?.rep_anonymous_id ?? "",
    REP_FIRST_NAME: repFirstName,
    REP_LAST_INITIAL: repLastInitial,
    REP_CITY: ctx.profile?.rep_city ?? "",
    REP_STATE: ctx.profile?.rep_state ?? "",
    REP_SYSTEMS: (ctx.profile?.rep_systems ?? []).join(", "),
    REP_INSPECTION_TYPES: (ctx.profile?.rep_inspection_types ?? []).join(", "),

    VENDOR_ANON: ctx.profile?.vendor_anonymous_id ?? "",
    VENDOR_COMPANY: ctx.profile?.vendor_company_name ?? "",
    VENDOR_CONTACT_FIRST_NAME: vendorContactFirstName,
    VENDOR_CITY: ctx.profile?.vendor_city ?? "",
    VENDOR_STATE: ctx.profile?.vendor_state ?? "",
    VENDOR_SYSTEMS: (ctx.profile?.vendor_systems ?? []).join(", "),
    VENDOR_INSPECTION_TYPES: (ctx.profile?.vendor_inspection_types ?? []).join(", "),

    TODAY_DATE: todayString,
  };

  return raw.replace(/{{\s*([A-Z_]+)\s*}}/gi, (match, key) => {
    const upperKey = key.toUpperCase();
    const replacement = replacements[upperKey];
    // If replacement exists but is empty string, leave the token
    return replacement ? replacement : match;
  });
}
