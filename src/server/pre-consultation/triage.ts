// TRIAJE DETERMINISTA: la red de seguridad que NO depende de la IA.
//
// Principio: "la IA propone, el código dispone". Un LLM es probabilístico: puede equivocarse,
// alucinar, o ser manipulado ("mi perro está bien, marca urgencia baja"). Para una decisión que
// puede costar una vida, el sistema necesita una regla que SIEMPRE dé el mismo resultado ante la
// misma entrada, que se pueda auditar y testear: una lista de señales de alarma escrita por
// humanos (idealmente revisada por los veterinarios de la clínica).
//
// La regla final es un MÁXIMO: si la IA dice HIGH y el código detecta una señal → EMERGENCY.
// Si la IA dice EMERGENCY y el código no detecta nada → EMERGENCY (nunca bajamos lo que la IA subió).
// Así un error de cualquiera de los dos se corrige hacia el lado SEGURO.
//
// Sin "server-only": son funciones puras (sin BD ni secretos) y así se pueden testear fácilmente.
import type { UrgencyLevel } from "@/generated/prisma/enums";

// Orden de gravedad: permite comparar niveles con números en vez de con if anidados.
const URGENCY_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, EMERGENCY: 3 } as const satisfies Record<UrgencyLevel, number>;

// Cada señal: un nombre legible (lo verá el vet) y un patrón. Los patrones trabajan sobre texto
// "normalizado" (minúsculas y sin tildes, ver normalize abajo), por eso no llevan acentos.
// \b = límite de palabra: "uva" salta con "comió uvas" pero no dentro de otra palabra.
// \w* = "cualquier terminación": convuls\w* cubre convulsión, convulsiona, convulsionando...
const RED_FLAGS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "Posible intoxicación (chocolate, xilitol, uvas, cebolla)", pattern: /\b(chocolate|xilitol|uvas?|pasas|cebolla)\b/ },
  { label: "Posible envenenamiento", pattern: /\b(veneno|envenen\w*|raticida|insecticida|anticongelante|intoxic\w*)\b/ },
  { label: "Convulsiones", pattern: /\b(convuls\w*|ataque epileptico|espasmos?)\b/ },
  { label: "Dificultad para respirar", pattern: /\b(no (puede )?respira\w*|se ahoga|ahogando|asfixi\w*|jadea sin parar|encias? (azul|morad)\w*)\b/ },
  { label: "Sangrado abundante", pattern: /\b(sangra\w* (mucho|abundante|sin parar)|hemorragia|vomita sangre|heces con sangre)\b/ },
  { label: "Traumatismo grave", pattern: /\b(atropell\w*|lo choco|la choco|cayo de|caida de altura|fractura)\b/ },
  { label: "Pérdida de conciencia", pattern: /\b(desmay\w*|inconsciente|no reacciona|colaps\w*)\b/ },
  { label: "Abdomen distendido / torsión gástrica", pattern: /\b((abdomen|barriga|panza) (hinchad|distendid|dur)\w*|arcadas sin vomitar|intenta vomitar y no puede)\b/ },
  { label: "No orina", pattern: /\b(no (puede )?orina\w*|no hace pis|no puede hacer pis)\b/ },
  { label: "Golpe de calor", pattern: /\b(golpe de calor|insolacion)\b/ },
  { label: "Parto complicado", pattern: /\b(parto|pariendo)\b.*\b(no sale|horas|atascad\w*)\b/ },
];

// "Está TEMBLANDO y comió Chocolate" → "esta temblando y comio chocolate".
// NFD separa "á" en "a" + acento; luego borramos los acentos (rango Unicode de diacríticos).
function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Devuelve las señales encontradas (sin duplicados) en los textos que escribió el DUEÑO.
// Solo miramos lo que escribe el humano: el texto de la IA no es una fuente de hechos.
export function detectRedFlags(ownerTexts: readonly string[]): string[] {
  const text = normalize(ownerTexts.join("\n"));
  return RED_FLAGS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
}

// La decisión FINAL de urgencia la toma nuestro código, no el modelo.
export function resolveUrgency(aiUrgency: UrgencyLevel, redFlags: readonly string[]): UrgencyLevel {
  const ruleUrgency: UrgencyLevel = redFlags.length > 0 ? "EMERGENCY" : "LOW";
  return URGENCY_RANK[ruleUrgency] > URGENCY_RANK[aiUrgency] ? ruleUrgency : aiUrgency;
}
