import { cookies } from "next/headers";

export type Lang = "es" | "en";

const en = {
  app: "Fiesta Planner", tagline: "Plan every celebration in one place",
  login: "Sign in", logout: "Sign out", email: "Email", password: "Password", name: "Name",
  badLogin: "Wrong email or password.", demoHint: "Demo accounts are listed in the README.",
  dashboard: "My events", newEvent: "New event", noEvents: "No events yet.", users: "Users", back: "Back",
  save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit", add: "Add", create: "Create", confirmDelete: "Delete this? This cannot be undone.",
  overview: "Overview", checklist: "Checklist", schedule: "Schedule", guests: "Guests", forms: "Forms", documents: "Documents",
  title: "Title", type: "Type", status: "Status", date: "Date", venue: "Venue", description: "Description", rsvpDeadline: "RSVP deadline",
  client: "Client", noClient: "No client", organizer: "Organizer", role: "Role",
  "type.WEDDING": "Wedding", "type.BIRTHDAY": "Birthday", "type.ANNIVERSARY": "Anniversary", "type.BABY_SHOWER": "Baby shower",
  "type.GRADUATION": "Graduation", "type.CORPORATE": "Corporate", "type.OTHER": "Other",
  "status.PLANNING": "Planning", "status.CONFIRMED": "Confirmed", "status.DONE": "Done", "status.CANCELLED": "Cancelled",
  "role.SUPERADMIN": "Superadmin", "role.ORGANIZER": "Organizer", "role.CLIENT": "Client",
  daysLeft: "{n} days to go", today: "Today!", past: "Past event",
  progress: "Checklist progress", confirmed: "Attending", declined: "Declined", pending: "Pending", headcount: "Confirmed headcount",
  useTemplate: "Start from a template for this event type", category: "Category", due: "Due", addTask: "Add task", overdue: "Overdue",
  startsAt: "Starts", endsAt: "Ends", location: "Location", notes: "Notes", addItem: "Add item", noItems: "Nothing here yet.", printView: "Print / PDF",
  phone: "Phone", maxParty: "Seats", addGuest: "Add guest", importCsv: "Import CSV (name,email,phone,seats)", exportCsv: "Export CSV", import: "Import",
  sendInvite: "Send invitation", resend: "Resend", sendAll: "Send to all pending", copyLink: "RSVP link", invited: "Invited", sendReminder: "Remind pending",
  outbox: "Sent messages", outboxNote: "No SMTP is configured, so messages are saved here (and can be sent with the mailto link).", openMail: "Open in mail app",
  "g.PENDING": "Pending", "g.ATTENDING": "Attending", "g.DECLINED": "Declined", dietary: "Dietary needs", message: "Message",
  newForm: "New form", formTitle: "Form title", fieldLabel: "Question", fieldType: "Answer type", options: "Options (comma separated)", required: "Required",
  "ft.text": "Short text", "ft.textarea": "Long text", "ft.number": "Number", "ft.select": "Choice", "ft.checkbox": "Yes/No", "ft.date": "Date",
  addField: "Add question", responses: "Responses", shareLink: "Public link", open: "Open", closed: "Closed", noResponses: "No responses yet.", yourName: "Your name",
  submit: "Submit", thanks: "Thank you! Your answers were saved.", formClosed: "This form is closed.", toggleOpen: "Open / close",
  upload: "Upload", file: "File", visibleToClient: "Visible to client", size: "Size", download: "Download", maxSize: "Max 10 MB per file.", tooBig: "File is larger than 10 MB.",
  invitedTo: "You are invited to", willAttend: "I will attend", cannotAttend: "I can't make it", howMany: "How many people (including you)?",
  rsvpClosed: "RSVP is closed for this event.", rsvpThanks: "Thanks! Your response was saved. You can change it until the deadline.", rsvpSaved: "Current response",
  newUser: "New user", tempPassword: "Temporary password", userCreated: "User created. Share the temporary password securely.", emailTaken: "That email is already registered.",
  onlyAdminDelete: "Only the superadmin can delete users.", createdBy: "Created by", language: "Language", changePassword: "New password", updated: "Saved.",
  budgetNote: "", noAccess: "Not found", myClients: "My clients", platform: "Platform admin", stats: "Platform statistics", totalEvents: "Events", totalGuests: "Guests",
  seats: "seats", of: "of", tasks: "tasks", total: "Total", attendeesCount: "People", allEvents: "All events",
};
const es: typeof en = {
  app: "Fiesta Planner", tagline: "Organiza cada celebración en un solo lugar",
  login: "Iniciar sesión", logout: "Cerrar sesión", email: "Correo", password: "Contraseña", name: "Nombre",
  badLogin: "Correo o contraseña incorrectos.", demoHint: "Las cuentas de demostración están en el README.",
  dashboard: "Mis eventos", newEvent: "Nuevo evento", noEvents: "Aún no hay eventos.", users: "Usuarios", back: "Volver",
  save: "Guardar", cancel: "Cancelar", delete: "Eliminar", edit: "Editar", add: "Agregar", create: "Crear", confirmDelete: "¿Eliminar? Esta acción no se puede deshacer.",
  overview: "Resumen", checklist: "Checklist", schedule: "Cronograma", guests: "Invitados", forms: "Formularios", documents: "Documentos",
  title: "Título", type: "Tipo", status: "Estado", date: "Fecha", venue: "Lugar", description: "Descripción", rsvpDeadline: "Fecha límite de RSVP",
  client: "Cliente", noClient: "Sin cliente", organizer: "Organizador", role: "Rol",
  "type.WEDDING": "Boda", "type.BIRTHDAY": "Cumpleaños", "type.ANNIVERSARY": "Aniversario", "type.BABY_SHOWER": "Baby shower",
  "type.GRADUATION": "Graduación", "type.CORPORATE": "Corporativo", "type.OTHER": "Otro",
  "status.PLANNING": "En planeación", "status.CONFIRMED": "Confirmado", "status.DONE": "Realizado", "status.CANCELLED": "Cancelado",
  "role.SUPERADMIN": "Superadmin", "role.ORGANIZER": "Organizador", "role.CLIENT": "Cliente",
  daysLeft: "Faltan {n} días", today: "¡Hoy!", past: "Evento pasado",
  progress: "Avance del checklist", confirmed: "Asisten", declined: "No asisten", pending: "Pendientes", headcount: "Asistentes confirmados",
  useTemplate: "Empezar con una plantilla para este tipo de evento", category: "Categoría", due: "Fecha límite", addTask: "Agregar tarea", overdue: "Vencida",
  startsAt: "Inicio", endsAt: "Fin", location: "Ubicación", notes: "Notas", addItem: "Agregar actividad", noItems: "Aún no hay nada aquí.", printView: "Imprimir / PDF",
  phone: "Teléfono", maxParty: "Lugares", addGuest: "Agregar invitado", importCsv: "Importar CSV (nombre,correo,teléfono,lugares)", exportCsv: "Exportar CSV", import: "Importar",
  sendInvite: "Enviar invitación", resend: "Reenviar", sendAll: "Enviar a todos los pendientes", copyLink: "Enlace RSVP", invited: "Invitado", sendReminder: "Recordar a pendientes",
  outbox: "Mensajes enviados", outboxNote: "No hay SMTP configurado, así que los mensajes se guardan aquí (y se pueden enviar con el enlace mailto).", openMail: "Abrir en correo",
  "g.PENDING": "Pendiente", "g.ATTENDING": "Asiste", "g.DECLINED": "No asiste", dietary: "Restricciones alimenticias", message: "Mensaje",
  newForm: "Nuevo formulario", formTitle: "Título del formulario", fieldLabel: "Pregunta", fieldType: "Tipo de respuesta", options: "Opciones (separadas por coma)", required: "Obligatoria",
  "ft.text": "Texto corto", "ft.textarea": "Texto largo", "ft.number": "Número", "ft.select": "Opción", "ft.checkbox": "Sí/No", "ft.date": "Fecha",
  addField: "Agregar pregunta", responses: "Respuestas", shareLink: "Enlace público", open: "Abierto", closed: "Cerrado", noResponses: "Aún no hay respuestas.", yourName: "Tu nombre",
  submit: "Enviar", thanks: "¡Gracias! Tus respuestas fueron guardadas.", formClosed: "Este formulario está cerrado.", toggleOpen: "Abrir / cerrar",
  upload: "Subir", file: "Archivo", visibleToClient: "Visible para el cliente", size: "Tamaño", download: "Descargar", maxSize: "Máximo 10 MB por archivo.", tooBig: "El archivo supera los 10 MB.",
  invitedTo: "Estás invitado a", willAttend: "Sí asistiré", cannotAttend: "No podré asistir", howMany: "¿Cuántas personas (contigo)?",
  rsvpClosed: "El RSVP está cerrado para este evento.", rsvpThanks: "¡Gracias! Tu respuesta fue guardada. Puedes cambiarla hasta la fecha límite.", rsvpSaved: "Respuesta actual",
  newUser: "Nuevo usuario", tempPassword: "Contraseña temporal", userCreated: "Usuario creado. Comparte la contraseña temporal de forma segura.", emailTaken: "Ese correo ya está registrado.",
  onlyAdminDelete: "Solo el superadmin puede eliminar usuarios.", createdBy: "Creado por", language: "Idioma", changePassword: "Nueva contraseña", updated: "Guardado.",
  budgetNote: "", noAccess: "No encontrado", myClients: "Mis clientes", platform: "Administración de la plataforma", stats: "Estadísticas de la plataforma", totalEvents: "Eventos", totalGuests: "Invitados",
  seats: "lugares", of: "de", tasks: "tareas", total: "Total", attendeesCount: "Personas", allEvents: "Todos los eventos",
};

const dict = { en, es };
export type Key = keyof typeof en;

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get("lang")?.value;
  return v === "en" ? "en" : "es";
}
export async function getT() {
  const lang = await getLang();
  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = (dict[lang] as Record<string, string>)[key] ?? (dict.en as Record<string, string>)[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
  return { t, lang, locale: lang === "es" ? "es-MX" : "en-US" };
}
export type TFn = Awaited<ReturnType<typeof getT>>["t"];
