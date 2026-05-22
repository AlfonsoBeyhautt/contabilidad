/** Rutas accesibles sin sesión (marketing + auth). */
export const PUBLIC_PATHS = ["/", "/login", "/registro"] as const;

export type PublicPath = (typeof PUBLIC_PATHS)[number];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Destino por defecto tras iniciar sesión. */
export const APP_HOME = "/inicio";
