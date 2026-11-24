// Script BLOQUEANTE que se ejecuta en <head>, ANTES de que el navegador pinte la página.
//
// ¿Por qué no un useEffect? Porque useEffect corre DESPUÉS del primer pintado: el usuario que
// eligió oscuro vería un destello blanco en cada carga (el famoso "flash of unstyled theme").
//
// ¿Por qué no una cookie leída en el servidor? Porque leer cookies en el layout raíz vuelve
// dinámica TODA la app y perdemos el prerenderizado estático de cacheComponents.
//
// Es un string fijo, sin datos del usuario: no hay riesgo de inyección (XSS).
export const THEME_STORAGE_KEY = "salusvet-theme";

const script = `(function () {
  try {
    var choice = localStorage.getItem("${THEME_STORAGE_KEY}");
    var dark = choice === "dark" ||
      (choice !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
