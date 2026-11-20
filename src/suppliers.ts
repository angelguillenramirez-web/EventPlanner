/** Suppliers registered on the platform (prototype data). Visible to Pro plan users. */
export const SUPPLIER_CATEGORIES = ["venue", "catering", "photo", "music", "decor", "cake", "entertainment", "rentals", "beauty", "transport"] as const;
export type SupplierCategory = (typeof SUPPLIER_CATEGORIES)[number];
export interface Supplier {
  id: string; name: string; category: SupplierCategory; supports: string[]; tier: 1 | 2 | 3; from: number; city: string; country: string; rating: number; about: string;
  phone: string; email: string; web: string; instagram: string; cover?: string; mine?: boolean; categories?: SupplierCategory[]; tagline?: string; logo?: string;
}
/** Your own profile as it appears in the market. */
export const profileToSupplier = (p: import("./store").SupplierProfile, logo = ""): Supplier => ({ id: "mine", name: p.name, category: (p.categories?.[0] ?? p.category) as SupplierCategory, categories: (p.categories?.length ? p.categories : [p.category]) as SupplierCategory[], tagline: p.tagline, logo, supports: p.supports, tier: p.tier, from: p.from, city: p.city, country: p.country, rating: 0, about: p.about || p.tagline, phone: p.phone, email: p.email, web: p.web, instagram: p.instagram, cover: p.cover, mine: true });
const ALL = ["wedding", "birthday", "babyshower", "graduation", "anniversary", "corporate"];
const s = (id: string, name: string, category: SupplierCategory, supports: string[], tier: 1 | 2 | 3, from: number, city: string, country: string, rating: number, about: string, phone: string, slug: string): Supplier =>
  ({ id, name, category, supports, tier, from, city, country, rating, about, phone, email: `hola@${slug}.example.com`, web: `www.${slug}.example.com`, instagram: `@${slug}` });

export const SUPPLIERS: Supplier[] = [
  s("s1", "Hacienda Los Arcos", "venue", ["wedding", "anniversary", "corporate"], 3, 6000, "Valle de Bravo", "México", 4.9, "Hacienda con jardines, capilla y salón para 250 personas.", "+52 726 100 2000", "haciendalosarcos"),
  s("s2", "Salón Aurora", "venue", ["birthday", "graduation", "babyshower"], 2, 1800, "Ciudad de México", "México", 4.6, "Salón versátil con terraza, ideal para fiestas de hasta 120 invitados.", "+52 55 5555 0101", "salonaurora"),
  s("s3", "Sabores de Mi Tierra", "catering", ALL, 2, 25, "Ciudad de México", "México", 4.8, "Banquetes mexicanos e internacionales; precio por persona.", "+52 55 5555 0202", "saboresdemitierra"),
  s("s4", "Gourmet Eventos", "catering", ["wedding", "corporate", "anniversary"], 3, 60, "Guadalajara", "México", 4.7, "Alta cocina, maridaje y servicio de meseros profesional.", "+52 33 3333 0303", "gourmeteventos"),
  s("s5", "Lente Dorado", "photo", ["wedding", "anniversary", "graduation"], 3, 1500, "Ciudad de México", "México", 4.9, "Fotografía y video cinematográfico, entrega en 3 semanas.", "+52 55 5555 0404", "lentedorado"),
  s("s6", "Click Fiesta", "photo", ["birthday", "babyshower", "graduation"], 1, 400, "Puebla", "México", 4.4, "Cobertura fotográfica económica para fiestas y cumpleaños.", "+52 222 222 0505", "clickfiesta"),
  s("s7", "DJ Ritmo Latino", "music", ["wedding", "birthday", "graduation", "corporate"], 2, 700, "Ciudad de México", "México", 4.7, "DJ, iluminación y sonido profesional.", "+52 55 5555 0606", "ritmolatino"),
  s("s8", "Cuarteto Armonía", "music", ["wedding", "anniversary"], 2, 900, "Guadalajara", "México", 4.8, "Música en vivo para ceremonia y cóctel.", "+52 33 3333 0707", "cuartetoarmonia"),
  s("s9", "Flores & Deco Primavera", "decor", ["wedding", "babyshower", "birthday"], 2, 800, "Valle de Bravo", "México", 4.8, "Arreglos florales, centros de mesa y ambientación completa.", "+52 726 100 0808", "floresprimavera"),
  s("s10", "Globos y Fantasía", "decor", ["birthday", "babyshower", "graduation"], 1, 250, "Ciudad de México", "México", 4.5, "Decoración con globos, arcos y backdrops temáticos.", "+52 55 5555 0909", "globosyfantasia"),
  s("s11", "Dulce Momento Pastelería", "cake", ALL, 2, 90, "Ciudad de México", "México", 4.9, "Pasteles personalizados y mesas de postres.", "+52 55 5555 1010", "dulcemomento"),
  s("s12", "Pop Show Animación", "entertainment", ["birthday", "babyshower"], 1, 200, "Monterrey", "México", 4.3, "Payasos, magos y shows infantiles.", "+52 81 8181 1111", "popshow"),
  s("s13", "Mobiliario Elegante", "rentals", ALL, 2, 300, "Ciudad de México", "México", 4.6, "Renta de mesas, sillas, carpas y vajilla.", "+52 55 5555 1212", "mobiliarioelegante"),
  s("s14", "Glam Studio Maquillaje", "beauty", ["wedding", "graduation", "anniversary"], 2, 120, "Guadalajara", "México", 4.7, "Maquillaje y peinado a domicilio para novias e invitadas.", "+52 33 3333 1313", "glamstudio"),
  s("s15", "Eventos Madrid Catering", "catering", ["wedding", "corporate", "birthday"], 3, 55, "Madrid", "España", 4.8, "Catering de autor para bodas y eventos corporativos.", "+34 910 000 141", "madridcatering"),
  s("s16", "Lisboa Fotografia", "photo", ["wedding", "anniversary"], 2, 1100, "Lisboa", "Portugal", 4.7, "Fotografia de casamentos e eventos em Lisboa e arredores.", "+351 210 000 151", "lisboafotografia"),
  s("s17", "Transporte VIP Eventos", "transport", ["wedding", "corporate"], 3, 500, "Ciudad de México", "México", 4.5, "Autos clásicos, limusinas y autobuses para invitados.", "+52 55 5555 1717", "transportevip"),
  s("s18", "Festa Brasil Buffet", "catering", ["birthday", "graduation", "babyshower"], 1, 18, "São Paulo", "Brasil", 4.4, "Buffet completo para festas, preço por pessoa.", "+55 11 4000 1818", "festabrasil"),
];
