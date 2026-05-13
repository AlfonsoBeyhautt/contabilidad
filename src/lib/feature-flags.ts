/**
 * Flags de funcionalidades globales.
 *
 * AUTH_DISABLED:
 *   true  → entrás directo al panel sin pasar por /login. El middleware no
 *           redirige, el DataProvider no exige sesión y el botón de "Salir" se
 *           oculta. Toda la lógica de login queda intacta para reactivar.
 *   false → comportamiento normal: middleware exige sesión y redirige al login.
 *
 * Para reactivar el login, simplemente cambiar el valor a `false` y hacer un
 * deploy o `npm run dev` de nuevo.
 */
export const AUTH_DISABLED = true;
