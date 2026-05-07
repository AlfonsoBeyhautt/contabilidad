import { redirect } from "next/navigation";

/** Ruta legada: defectuosos vive dentro de Gastos. */
export default function DefectuososRedirectPage() {
  redirect("/gastos?sub=defectuosos");
}
