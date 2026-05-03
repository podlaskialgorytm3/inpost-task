"use client";

import Link from "next/link";
import styles from "./page.module.css";
import { LOCALES, type Locale, useAppSettings } from "./providers";

const landingCopy = {
  pl: {
    badge: "InPost Smart Finder",
    title: "Znajdź najlepszy paczkomat w kilka sekund",
    subtitle:
      "Nowoczesna wyszukiwarka punktów InPost z filtrowaniem po lokalizacji, odległości, dostępności i funkcjach.",
    ctaPrimary: "Przejdź do systemu",
    ctaSecondary: "Zobacz szczegóły działania",
    whyTitle: "Po co powstała ta aplikacja?",
    whyCopy:
      "Aplikacja upraszcza wybór punktu nadania i odbioru: pokazuje tylko to, co ma znaczenie w danym momencie, zamiast wymagać ręcznego przeglądania wielu lokalizacji.",
    feat1Title: "Szybkie wyszukiwanie",
    feat1Copy:
      "Filtruj po mieście, kodzie, promieniu i funkcjach punktu, żeby od razu zawęzić wyniki.",
    feat2Title: "Decyzje oparte na danych",
    feat2Copy:
      "Sortowanie po odległości i dostępności pomaga wybrać najwygodniejszy punkt tu i teraz.",
    feat3Title: "Pełny kontekst",
    feat3Copy:
      "W jednym miejscu masz godziny, typ punktu, dostępność i mapę do szybkiej decyzji.",
    sectionTitle: "Co dostajesz w systemie?",
  },
  en: {
    badge: "InPost Smart Finder",
    title: "Find the best parcel locker in seconds",
    subtitle:
      "A modern InPost point finder with filtering by location, distance, availability, and service functions.",
    ctaPrimary: "Open the system",
    ctaSecondary: "How it works",
    whyTitle: "Why was this app created?",
    whyCopy:
      "It simplifies choosing a pickup or drop-off point by showing only what matters right now, instead of manually browsing many locations.",
    feat1Title: "Fast search",
    feat1Copy:
      "Filter by city, postal code, radius, and point functions to narrow results instantly.",
    feat2Title: "Data-driven choices",
    feat2Copy:
      "Distance and availability sorting helps you pick the most convenient point at the moment.",
    feat3Title: "Full context",
    feat3Copy:
      "Opening hours, point type, availability, and map access in one place for quick decisions.",
    sectionTitle: "What do you get in the system?",
  },
  de: {
    badge: "InPost Smart Finder",
    title: "Finden Sie den besten Paketautomaten in Sekunden",
    subtitle:
      "Eine moderne InPost-Suche mit Filtern nach Standort, Entfernung, Verfügbarkeit und Funktionen.",
    ctaPrimary: "System öffnen",
    ctaSecondary: "So funktioniert es",
    whyTitle: "Warum wurde diese App erstellt?",
    whyCopy:
      "Sie vereinfacht die Auswahl eines Abgabe- oder Abholpunkts, indem nur relevante Informationen gezeigt werden.",
    feat1Title: "Schnelle Suche",
    feat1Copy:
      "Filtern Sie nach Stadt, Postleitzahl, Radius und Funktionen, um Ergebnisse sofort einzugrenzen.",
    feat2Title: "Datenbasierte Auswahl",
    feat2Copy:
      "Sortierung nach Entfernung und Verfügbarkeit hilft bei der besten Wahl im aktuellen Moment.",
    feat3Title: "Voller Kontext",
    feat3Copy:
      "Öffnungszeiten, Typ, Verfügbarkeit und Karte an einem Ort für schnelle Entscheidungen.",
    sectionTitle: "Was bekommen Sie im System?",
  },
  fr: {
    badge: "InPost Smart Finder",
    title: "Trouvez la meilleure consigne en quelques secondes",
    subtitle:
      "Un outil moderne de recherche InPost avec filtres par localisation, distance, disponibilité et fonctions.",
    ctaPrimary: "Accéder au système",
    ctaSecondary: "Comment ça marche",
    whyTitle: "Pourquoi cette application a-t-elle été créée ?",
    whyCopy:
      "Elle simplifie le choix d'un point de dépôt ou de retrait en affichant uniquement les infos utiles au bon moment.",
    feat1Title: "Recherche rapide",
    feat1Copy:
      "Filtrez par ville, code postal, rayon et fonctions pour réduire les résultats immédiatement.",
    feat2Title: "Choix basé sur les données",
    feat2Copy:
      "Le tri par distance et disponibilité aide à choisir le point le plus pratique.",
    feat3Title: "Contexte complet",
    feat3Copy:
      "Horaires, type de point, disponibilité et carte dans une seule vue.",
    sectionTitle: "Ce que vous obtenez dans le système",
  },
} as const;

export default function LandingPage() {
  const { locale, setLocale, theme, toggleTheme } = useAppSettings();
  const t = landingCopy[locale];

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.topbar}>
          <span className={styles.badge}>{t.badge}</span>
          <div className={styles.controls}>
            <select
              className={styles.localeSelect}
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
            >
              {LOCALES.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.themeToggle}
              onClick={toggleTheme}
              aria-pressed={theme === "dark"}
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>
        </div>

        <h1 className={styles.title}>{t.title}</h1>
        <p className={styles.subtitle}>{t.subtitle}</p>

        <div className={styles.actions}>
          <Link href="/finder" className={styles.primaryCta}>
            {t.ctaPrimary}
          </Link>
          <a href="#about" className={styles.secondaryCta}>
            {t.ctaSecondary}
          </a>
        </div>
      </header>

      <section id="about" className={styles.section}>
        <h2 className={styles.sectionTitle}>{t.whyTitle}</h2>
        <p className={styles.sectionCopy}>{t.whyCopy}</p>
      </section>

      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>{t.sectionTitle}</h2>
        <div className={styles.grid}>
          <article className={styles.card}>
            <h3>{t.feat1Title}</h3>
            <p>{t.feat1Copy}</p>
          </article>
          <article className={styles.card}>
            <h3>{t.feat2Title}</h3>
            <p>{t.feat2Copy}</p>
          </article>
          <article className={styles.card}>
            <h3>{t.feat3Title}</h3>
            <p>{t.feat3Copy}</p>
          </article>
        </div>
      </section>
    </main>
  );
}
