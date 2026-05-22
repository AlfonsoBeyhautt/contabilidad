import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "ContabilidadD — Gestión financiera para tu negocio",
  description:
    "Ingresos, egresos, stock, inteligencia del negocio y reportes en un panel claro y profesional.",
};

export default function MarketingHomePage() {
  return <LandingPage />;
}
