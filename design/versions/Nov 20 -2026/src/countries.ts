/** Countries offered for phone / WhatsApp numbers: ISO code, name and dial code. */
export const COUNTRIES: { iso: string; name: string; dial: string }[] = [
  { iso: "MX", name: "México", dial: "+52" }, { iso: "US", name: "United States", dial: "+1" }, { iso: "CA", name: "Canada", dial: "+1" },
  { iso: "ES", name: "España", dial: "+34" }, { iso: "PT", name: "Portugal", dial: "+351" }, { iso: "BR", name: "Brasil", dial: "+55" },
  { iso: "AR", name: "Argentina", dial: "+54" }, { iso: "CL", name: "Chile", dial: "+56" }, { iso: "CO", name: "Colombia", dial: "+57" },
  { iso: "PE", name: "Perú", dial: "+51" }, { iso: "VE", name: "Venezuela", dial: "+58" }, { iso: "EC", name: "Ecuador", dial: "+593" },
  { iso: "UY", name: "Uruguay", dial: "+598" }, { iso: "PY", name: "Paraguay", dial: "+595" }, { iso: "BO", name: "Bolivia", dial: "+591" },
  { iso: "CR", name: "Costa Rica", dial: "+506" }, { iso: "PA", name: "Panamá", dial: "+507" }, { iso: "GT", name: "Guatemala", dial: "+502" },
  { iso: "SV", name: "El Salvador", dial: "+503" }, { iso: "HN", name: "Honduras", dial: "+504" }, { iso: "NI", name: "Nicaragua", dial: "+505" },
  { iso: "DO", name: "República Dominicana", dial: "+1" }, { iso: "PR", name: "Puerto Rico", dial: "+1" }, { iso: "CU", name: "Cuba", dial: "+53" },
  { iso: "GB", name: "United Kingdom", dial: "+44" }, { iso: "FR", name: "France", dial: "+33" }, { iso: "DE", name: "Deutschland", dial: "+49" },
  { iso: "IT", name: "Italia", dial: "+39" }, { iso: "NL", name: "Nederland", dial: "+31" }, { iso: "IE", name: "Ireland", dial: "+353" },
  { iso: "AU", name: "Australia", dial: "+61" }, { iso: "JP", name: "日本", dial: "+81" }, { iso: "IN", name: "India", dial: "+91" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971" }, { iso: "ZA", name: "South Africa", dial: "+27" },
];
/** Flag emoji from an ISO country code. */
export const flag = (iso: string) => String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
export const dialOf = (iso: string) => COUNTRIES.find((c) => c.iso === iso)?.dial ?? "";
