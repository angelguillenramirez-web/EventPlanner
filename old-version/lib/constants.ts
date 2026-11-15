export const EVENT_TYPES = ["WEDDING", "BIRTHDAY", "ANNIVERSARY", "BABY_SHOWER", "GRADUATION", "CORPORATE", "OTHER"] as const;
export const EVENT_STATUSES = ["PLANNING", "CONFIRMED", "DONE", "CANCELLED"] as const;
export const ROLES = ["SUPERADMIN", "ORGANIZER", "CLIENT"] as const;
export const FIELD_TYPES = ["text", "textarea", "number", "select", "checkbox", "date"] as const;
export type Role = (typeof ROLES)[number];
export type FieldType = (typeof FIELD_TYPES)[number];
export type FormField = { id: string; label: string; type: FieldType; options?: string[]; required: boolean };

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Starter checklists: [category, title_es, title_en, daysBeforeEvent]
type T = [string, string, string, number];
const COMMON: T[] = [
  ["Planning", "Definir presupuesto", "Set the budget", 180],
  ["Planning", "Definir lista preliminar de invitados", "Draft the guest list", 150],
  ["Venue", "Reservar lugar", "Book the venue", 150],
  ["Food", "Contratar catering / menú", "Book catering / menu", 90],
  ["Invitations", "Enviar invitaciones y RSVP", "Send invitations and RSVP", 60],
  ["Logistics", "Confirmar proveedores", "Confirm vendors", 14],
  ["Logistics", "Confirmar número final de invitados", "Confirm final headcount", 7],
  ["Logistics", "Armar cronograma del día", "Finalize day-of schedule", 3],
];
export const CHECKLIST_TEMPLATES: Record<string, T[]> = {
  WEDDING: [
    ...COMMON,
    ["Style", "Elegir vestido / traje", "Choose dress / suit", 120],
    ["Vendors", "Contratar fotógrafo", "Hire photographer", 150],
    ["Vendors", "Contratar música / DJ", "Hire music / DJ", 120],
    ["Legal", "Trámites y documentos legales", "Legal paperwork", 90],
    ["Seating", "Plan de mesas", "Seating plan", 14],
  ],
  BIRTHDAY: [...COMMON, ["Food", "Pastel", "Order the cake", 14], ["Fun", "Decoración y música", "Decorations and music", 10]],
  ANNIVERSARY: [...COMMON, ["Fun", "Preparar video / fotos", "Prepare photo / video tribute", 20]],
  BABY_SHOWER: [...COMMON, ["Fun", "Juegos y actividades", "Games and activities", 14], ["Gifts", "Mesa de regalos", "Gift registry", 45]],
  GRADUATION: [...COMMON, ["Fun", "Fotos y recuerdos", "Photos and keepsakes", 10]],
  CORPORATE: [...COMMON, ["AV", "Equipo audiovisual", "AV equipment", 14], ["Agenda", "Confirmar ponentes", "Confirm speakers", 30]],
  OTHER: COMMON,
};
