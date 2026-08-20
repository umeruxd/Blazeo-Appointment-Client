/** Default enum values aligned with ApexFlows / Blazeo (`AssignmentMethod`, `Unit`). */
const DEFAULT_ASSIGNMENT_METHOD = 1;
const DEFAULT_UNIT_MINUTES = 1;

/**
 * For Blazeo `Calendar` MST: `types.optional(types.number)` accepts `undefined` (uses default)
 * but not `null`. Coerce null/absent to `undefined`.
 */
function optionalNumber(v: any) {
  return v == null ? undefined : v;
}

/**
 * Maps Apex `CalendarBO`-shaped input to a snapshot for
 * {@link CalendarModel.create} from `@blazeo.com/calendar-client`.
 *
 * Only fields that exist on Blazeo's `Calendar` model are included so MST does not receive
 * unknown keys or invalid `null`s on optional numbers.
 */
export function mapCalendarBOToSnapshot(bo: any) {
  const c = globalThis.crypto;
  const generatedId = c?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const calendarId = bo.calendarId ?? generatedId;
  return {
    companyKey: bo.companyKey ?? null,
    calendarId,
    name: bo.name ?? null,
    timeZoneId: bo.timeZoneId ?? null,
    purpose: bo.purpose ?? bo.bookingPageTitle ?? "",
    description: bo.description ?? null,
    assignmentMethod: bo.assignmentMethod ?? bo.assignmentType ?? DEFAULT_ASSIGNMENT_METHOD,
    duration: optionalNumber(bo.duration) ?? 30,
    durationUnit: optionalNumber(bo.durationUnit) ?? DEFAULT_UNIT_MINUTES,
    minimumBookingNotice: optionalNumber(bo.minimumBookingNotice) ?? 0,
    minimumBookingNoticeUnit: optionalNumber(bo.minimumBookingNoticeUnit) ?? DEFAULT_UNIT_MINUTES,
    minimumCancelationNotice: optionalNumber(bo.minimumCancelationNotice) ?? 0,
    minimumCancelationNoticeUnit: optionalNumber(bo.minimumCancelationNoticeUnit) ?? DEFAULT_UNIT_MINUTES,
    futureLimit: optionalNumber(bo.futureLimit) ?? 0,
    futureLimitUnit: optionalNumber(bo.futureLimitUnit) ?? 3,
    bufferTime: optionalNumber(bo.bufferTime),
    bufferTimeUnit: optionalNumber(bo.bufferTimeUnit) ?? DEFAULT_UNIT_MINUTES,
    bookingLimit: optionalNumber(bo.bookingLimit),
    createdOn: bo.createdOn ?? null,
    modifiedOn: bo.modifiedOn ?? null,
    ccEmails: Array.isArray(bo.ccEmail) ? bo.ccEmail.join(",") : (bo.ccEmail || ""),
    bccEmails: Array.isArray(bo.bccEmail) ? bo.bccEmail.join(",") : (bo.bccEmail || ""),
  };
}
