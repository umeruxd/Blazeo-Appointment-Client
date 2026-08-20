import { collectAppointmentReminders } from "../preference/mapEventReminderPreference.js";
import { isCrmCalendar } from "./isCrmCalendar.js";
import {
  collectAppointmentLocations,
  sortFrontendLocations,
  type FrontendAppointmentLocation,
} from "./mapCalendarLocation.js";

const DAY_NAME_TO_NUMBER: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

export type FrontendCalendarOpeningHour = {
  days: number[];
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  participantId: string;
};

export type FrontendCalendarMember = {
  id: string;
  name?: string | null;
  alias?: string | null;
};

export type FrontendCalendarView = {
  calendarId?: string;
  openingHours: FrontendCalendarOpeningHour[];
  name?: string | null;
  timeZoneId?: string | null;
  description?: string | null;
  bookingPageTitle?: string | null;
  assignmentType?: number | null;
  duration?: number | null;
  durationUnit?: number | null;
  minimumBookingNotice?: number | null;
  minimumBookingNoticeUnit?: number | null;
  minimumCancelationNotice?: number | null;
  minimumCancelationNoticeUnit?: number | null;
  futureLimit?: number | null;
  futureLimitUnit?: number | null;
  bufferTime?: number | null;
  bufferTimeUnit?: number | null;
  bookingLimit?: number | null;
  members: FrontendCalendarMember[];
  appointmentReminders: Array<{
    channelType: number;
    recipientType: number;
    beforeEventTime: number;
    unit: number;
  }>;
  appointmentUserDefinedFields: unknown[];
  crmLeadCustomFields?: unknown[];
  isCrm?: boolean;
  logoUrl?: string | null;
  color?: string | null;
  themeId?: number | null;
  logoImage?: string | null;
  appointmentLocations: FrontendAppointmentLocation[];
  theme?: { color?: string | null; id?: number | null } | null;
  companyKey?: string | null;
  ccEmail?: string[] | string;
  bccEmail?: string[] | string;
};

function resolveFrontendIsCrm(view: Record<string, unknown>, raw: Record<string, unknown>): boolean {
  return isCrmCalendar({ ...raw, ...view });
}

function pick<T>(obj: any, ...keys: string[]): T | undefined {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj?.[k] !== null) return obj[k] as T;
  }
  return undefined;
}

function n(v: any): number | null {
  return v != null && v !== "" ? Number(v) : null;
}

function dayToNumber(d: unknown): number | null {
  if (typeof d === "number" && !Number.isNaN(d)) return d;
  const s = String(d).trim().toUpperCase();
  if (DAY_NAME_TO_NUMBER[s] !== undefined) return DAY_NAME_TO_NUMBER[s];
  const parsed = Number(s);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Group per-day API rows or merged slots into frontend `openingHours[]` (active days only).
 */
export function mapOpeningHoursToFrontend(rows: any[]): FrontendCalendarOpeningHour[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const slotKey = (participantId: string, startH: number, startM: number, endH: number, endM: number) =>
    `${participantId}|${startH}|${startM}|${endH}|${endM}`;

  const groups = new Map<
    string,
    {
      days: Set<number>;
      startHour: number;
      startMinute: number;
      endHour: number;
      endMinute: number;
      participantId: string;
    }
  >();

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    if (Boolean(pick(raw, "off", "Off"))) continue;

    const participantId = String(
      pick(raw, "participantId", "ParticipantId", "participant_id", "member", "Member") ?? ""
    ).trim();
    if (!participantId) continue;

    const startHour = Number(pick(raw, "startHour", "StartHour") ?? 0) || 0;
    const startMinute = Number(pick(raw, "startMinute", "StartMinute") ?? 0) || 0;
    const endHour = Number(pick(raw, "endHour", "EndHour") ?? 0) || 0;
    const endMinute = Number(pick(raw, "endMinute", "EndMinute") ?? 0) || 0;

    const key = slotKey(participantId, startHour, startMinute, endHour, endMinute);
    if (!groups.has(key)) {
      groups.set(key, {
        days: new Set(),
        startHour,
        startMinute,
        endHour,
        endMinute,
        participantId,
      });
    }
    const group = groups.get(key)!;

    const dayNum = pick<number>(raw, "day", "Day");
    if (dayNum != null && dayNum >= 0 && dayNum <= 6) {
      group.days.add(dayNum);
    }

    const daysField = raw.days ?? raw.Days;
    if (Array.isArray(daysField)) {
      for (const d of daysField) {
        const num = dayToNumber(d);
        if (num != null && num >= 0 && num <= 6) group.days.add(num);
      }
    }
  }

  return [...groups.values()]
    .filter((g) => g.days.size > 0)
    .map((g) => ({
      days: [...g.days].sort((a, b) => a - b),
      startHour: g.startHour,
      startMinute: g.startMinute,
      endHour: g.endHour,
      endMinute: g.endMinute,
      participantId: g.participantId,
    }));
}

function mapAppointmentRemindersForFrontend(view: Record<string, any>) {
  const fromFlat = collectAppointmentReminders(view);
  return fromFlat
    .filter((r) => r.channelType != null && r.recipientType != null)
    .map((r) => ({
      channelType: Number(r.channelType),
      recipientType: Number(r.recipientType),
      beforeEventTime: Number(r.beforeEventTime ?? 0),
      unit: Number(r.unit ?? 1),
    }));
}

/**
 * Portal / ApexFlows calendar edit shape (matches create/update payload).
 */
export function mapToFrontendCalendarView(
  enrichedView: Record<string, any>,
  rawPayload?: Record<string, any> | null,
  rawOpeningHoursRows?: any[] | null,
  fetchedAppointmentLocations?: FrontendAppointmentLocation[] | null
): FrontendCalendarView {
  const raw = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
  const view = enrichedView ?? {};

  const calendarId =
    pick<string>(view, "calendarId", "uuid", "Uuid") ??
    pick<string>(raw, "calendarId", "CalendarId", "uuid", "Uuid");

  const openingHoursSource =
    Array.isArray(rawOpeningHoursRows) && rawOpeningHoursRows.length > 0
      ? rawOpeningHoursRows
      : (view.openingHours ?? []);

  const themeFromView = view.theme && typeof view.theme === "object" ? view.theme : null;
  const themeId =
    n(pick(view, "themeId", "ThemeId")) ??
    n(pick(raw, "themeId", "ThemeId")) ??
    n(pick(themeFromView, "id", "Id"));
  const color =
    pick<string>(view, "color", "Color") ??
    pick<string>(raw, "color", "Color") ??
    pick<string>(themeFromView, "color", "Color") ??
    null;
  const logoUrl =
    pick<string>(view, "logoUrl", "LogoUrl") ??
    pick<string>(raw, "logoUrl", "LogoUrl") ??
    pick<string>(themeFromView, "logoUrl", "LogoUrl") ??
    null;

  const members = (Array.isArray(view.members) ? view.members : [])
    .map((m: any) => ({
      id: String(m?.id ?? pick(m, "id", "Id", "participantId", "ParticipantId") ?? "").trim(),
      name: (pick(m, "name", "Name") ?? "") as string,
      alias: (pick(m, "alias", "Alias") ?? "") as string,
    }))
    .filter((m) => m.id);

  return {
    ...(calendarId ? { calendarId } : {}),
    openingHours: mapOpeningHoursToFrontend(openingHoursSource),
    name: pick(view, "name", "Name") ?? pick(raw, "name", "Name") ?? null,
    timeZoneId: pick(view, "timeZoneId", "TimeZoneId") ?? pick(raw, "timeZoneId", "TimeZoneId") ?? null,
    description: pick(view, "description", "Description") ?? pick(raw, "description", "Description") ?? "",
    bookingPageTitle:
      pick(view, "bookingPageTitle", "BookingPageTitle") ??
      pick(raw, "bookingPageTitle", "BookingPageTitle") ??
      null,
    assignmentType:
      n(pick(view, "assignmentType", "AssignmentType", "assignmentMethod", "AssignmentMethod")) ??
      n(pick(raw, "assignmentType", "AssignmentType", "assignmentMethod", "AssignmentMethod")),
    duration: n(pick(view, "duration", "Duration")) ?? n(pick(raw, "duration", "Duration")),
    durationUnit: n(pick(view, "durationUnit", "DurationUnit")) ?? n(pick(raw, "durationUnit", "DurationUnit")),
    minimumBookingNotice:
      n(pick(view, "minimumBookingNotice", "MinimumBookingNotice")) ??
      n(pick(raw, "minimumBookingNotice", "MinimumBookingNotice")),
    minimumBookingNoticeUnit:
      n(pick(view, "minimumBookingNoticeUnit", "MinimumBookingNoticeUnit")) ??
      n(pick(raw, "minimumBookingNoticeUnit", "MinimumBookingNoticeUnit")),
    minimumCancelationNotice:
      n(pick(view, "minimumCancelationNotice", "MinimumCancelationNotice")) ??
      n(pick(raw, "minimumCancelationNotice", "MinimumCancelationNotice")),
    minimumCancelationNoticeUnit:
      n(pick(view, "minimumCancelationNoticeUnit", "MinimumCancelationNoticeUnit")) ??
      n(pick(raw, "minimumCancelationNoticeUnit", "MinimumCancelationNoticeUnit")),
    futureLimit: n(pick(view, "futureLimit", "FutureLimit")) ?? n(pick(raw, "futureLimit", "FutureLimit")),
    futureLimitUnit:
      n(pick(view, "futureLimitUnit", "FutureLimitUnit")) ?? n(pick(raw, "futureLimitUnit", "FutureLimitUnit")),
    bufferTime: n(pick(view, "bufferTime", "BufferTime")) ?? n(pick(raw, "bufferTime", "BufferTime")),
    bufferTimeUnit:
      n(pick(view, "bufferTimeUnit", "BufferTimeUnit")) ?? n(pick(raw, "bufferTimeUnit", "BufferTimeUnit")),
    bookingLimit: n(pick(view, "bookingLimit", "BookingLimit")) ?? n(pick(raw, "bookingLimit", "BookingLimit")),
    members,
    appointmentReminders: mapAppointmentRemindersForFrontend(view),
    appointmentUserDefinedFields:
      pick(view, "appointmentUserDefinedFields", "AppointmentUserDefinedFields") ??
      pick(raw, "appointmentUserDefinedFields", "AppointmentUserDefinedFields") ??
      [],
    ...(pick(view, "crmLeadCustomFields", "CrmLeadCustomFields") != null ||
    pick(raw, "crmLeadCustomFields", "CrmLeadCustomFields") != null
      ? {
          crmLeadCustomFields:
            pick(view, "crmLeadCustomFields", "CrmLeadCustomFields") ??
            pick(raw, "crmLeadCustomFields", "CrmLeadCustomFields") ??
            [],
        }
      : {}),
    ...(resolveFrontendIsCrm(view, raw) ? { isCrm: true } : {}),
    logoUrl,
    color,
    themeId,
    logoImage: pick(raw, "logoImage", "LogoImage") ?? pick(view, "logoImage", "LogoImage") ?? null,
    appointmentLocations: sortFrontendLocations(
      (Array.isArray(fetchedAppointmentLocations) && fetchedAppointmentLocations.length > 0
        ? fetchedAppointmentLocations
        : collectAppointmentLocations({ ...raw, ...view })) ?? []
    ),
    theme:
      themeId != null || color
        ? {
            color: color ?? pick(themeFromView, "color", "Color") ?? null,
            id: themeId ?? n(pick(themeFromView, "id", "Id")),
          }
        : null,
    companyKey: pick(view, "companyKey", "CompanyKey") ?? pick(raw, "companyKey", "CompanyKey") ?? null,
    ccEmail: (() => {
      const rawCc = pick(view, "ccEmails", "CcEmails") ?? pick(raw, "ccEmails", "CcEmails");
      return Array.isArray(rawCc) ? rawCc : (typeof rawCc === "string" ? (rawCc ? rawCc.split(",") : []) : []);
    })(),
    bccEmail: (() => {
      const rawBcc = pick(view, "bccEmails", "BccEmails") ?? pick(raw, "bccEmails", "BccEmails");
      return Array.isArray(rawBcc) ? rawBcc : (typeof rawBcc === "string" ? (rawBcc ? rawBcc.split(",") : []) : []);
    })(),
  };
}
