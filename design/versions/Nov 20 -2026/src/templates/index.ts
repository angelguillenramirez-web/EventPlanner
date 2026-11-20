// The full-page invitation templates that ship with the platform.
// This file is shared: the customer app uses it as its built-in catalogue and the 643 staff console imports it
// to list them (so there is one single copy of every document). Staff can then edit, unpublish or add more from 643.
import botanica from "./botanica.html?raw";
import lino from "./lino.html?raw";
import deco from "./deco.html?raw";
import costa from "./costa.html?raw";
import mono from "./mono.html?raw";
import dino from "./dino.html?raw";
import cosmos from "./cosmos.html?raw";
import eras from "./eras.html?raw";

export interface BuiltinTemplate {
  id: string;
  /** English name, as shown in the staff console (customers see translated labels from dict.ts). */
  name: string;
  /** Main event type, and every event type it suits (used to list the relevant templates first). */
  category: string;
  suits: string[];
  html: string;
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  { id: "botanica", name: "Botanical", category: "wedding", suits: ["wedding", "anniversary"], html: botanica },
  { id: "lino", name: "Linen · minimal", category: "wedding", suits: ["wedding", "anniversary", "corporate", "graduation"], html: lino },
  { id: "deco", name: "Art Deco", category: "wedding", suits: ["wedding", "anniversary", "corporate"], html: deco },
  { id: "costa", name: "Coastal", category: "wedding", suits: ["wedding", "anniversary"], html: costa },
  { id: "mono", name: "Mono party", category: "birthday", suits: ["birthday", "corporate", "graduation"], html: mono },
  { id: "dino", name: "Dinosaurs", category: "birthday", suits: ["birthday"], html: dino },
  { id: "cosmos", name: "Space", category: "birthday", suits: ["birthday"], html: cosmos },
  { id: "eras", name: "Glitter night", category: "birthday", suits: ["birthday", "anniversary"], html: eras },
];
