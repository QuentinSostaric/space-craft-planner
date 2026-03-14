import type { FarmLocation } from '../types';

export const FARM_LOCATIONS: FarmLocation[] = [
  // ── Mining ─────────────────────────────────────────────────────────────────
  {
    id: 'lyria-mining',
    name: 'Lyria',
    system: 'Stanton',
    body: 'ArcCorp moon',
    type: 'mining',
    efficiency: 'high',
    description: {
      en: 'Rich in ferrous minerals and titanium. Dense surface deposits, easy to reach.',
      fr: 'Lune riche en minerais ferreux et titane. Gisements denses en surface, facilement accessibles.',
    },
    resourceIds: ['Iron', 'Titanium', 'Aluminum', 'Silicon'],
  },
  {
    id: 'wala-mining',
    name: 'Wala',
    system: 'Stanton',
    body: 'ArcCorp moon',
    type: 'mining',
    efficiency: 'high',
    description: {
      en: 'Volcanic terrain with high concentrations of titanium and carbon.',
      fr: 'Terrain volcanique offrant du titane et du carbone en haute concentration.',
    },
    resourceIds: ['Titanium', 'Tungsten', 'Copper', 'Silicon'],
  },
  {
    id: 'daymar-mining',
    name: 'Daymar',
    system: 'Stanton',
    body: 'Crusader moon',
    type: 'mining',
    efficiency: 'medium',
    description: {
      en: 'Desert surface scattered with iron and copper deposits.',
      fr: 'Surface désertique parsemée de gisements de fer et cuivre.',
    },
    resourceIds: ['Iron', 'Copper', 'Tin', 'Quartz'],
  },
  {
    id: 'cellin-mining',
    name: 'Cellin',
    system: 'Stanton',
    body: 'Crusader moon',
    type: 'mining',
    efficiency: 'medium',
    description: {
      en: 'High geological activity. Good source of silicon and quality corundum.',
      fr: 'Activité géologique élevée. Source de silicium et corindon de qualité.',
    },
    resourceIds: ['Silicon', 'Corundum', 'Beryl', 'Gold'],
  },
  {
    id: 'magda-mining',
    name: 'Magda',
    system: 'Stanton',
    body: 'Hurston moon',
    type: 'mining',
    efficiency: 'medium',
    description: {
      en: 'Light metals moon. Accessible aluminum and lindinium deposits.',
      fr: 'Lune en métaux légers. Gisements d\'aluminium et lindinium facilement accessibles.',
    },
    resourceIds: ['Aluminum', 'Lindinium', 'Iron', 'Copper'],
  },
  {
    id: 'arial-mining',
    name: 'Arial',
    system: 'Stanton',
    body: 'Hurston moon',
    type: 'mining',
    efficiency: 'low',
    description: {
      en: 'Difficult terrain but rare corundum and laranite deposits can be found.',
      fr: 'Terrain difficile mais gisements de corindon et laranite rares.',
    },
    resourceIds: ['Corundum', 'Laranite', 'Aluminum', 'Silicon'],
  },
  {
    id: 'nyx-rockcracker',
    name: 'Rockcracker Stations — Nyx',
    system: 'Nyx',
    type: 'mining',
    efficiency: 'high',
    description: {
      en: 'Industrial mining stations in Nyx specializing in rare CMR material extraction. Organization-controlled. High PvP risk.',
      fr: 'Stations industrielles de Nyx spécialisées dans l\'extraction de matériaux CMR rares. Contrôlées par des organisations. Risque PvP élevé.',
    },
    resourceIds: ['Torite', 'Lindinium', 'Stileron', 'Savrilium', 'Ouratite', 'Agricium', 'Taranite'],
  },
  {
    id: 'nyx-asteroid',
    name: 'Nyx Asteroid Belt',
    system: 'Nyx',
    type: 'mining',
    efficiency: 'high',
    description: {
      en: 'Dense asteroid belt rich in SC-specific minerals. Best source for rare crafting materials.',
      fr: 'Ceinture d\'astéroïdes dense riche en minéraux spécifiques. Meilleure source pour les matériaux rares.',
    },
    resourceIds: ['Torite', 'Hephaestanite', 'Aslarite', 'Riccite', 'Lindinium', 'Stileron'],
  },

  // ── Salvage ────────────────────────────────────────────────────────────────
  {
    id: 'stanton-wrecks',
    name: 'Stanton Wrecks',
    system: 'Stanton',
    type: 'salvage',
    efficiency: 'medium',
    description: {
      en: 'Combat zones and trade routes are scattered with salvageable wrecks. Mainly CMP materials.',
      fr: 'Les zones de combat et routes commerciales sont parsemées d\'épaves récupérables. Matériaux CMP principalement.',
    },
    resourceIds: ['Iron', 'Titanium', 'Aluminum', 'Copper', 'Silicon'],
  },
  {
    id: 'nyx-wrecks',
    name: 'Nyx Wrecks',
    system: 'Nyx',
    type: 'salvage',
    efficiency: 'high',
    description: {
      en: 'Intense conflict zone. Fresh wrecks in large quantities, sometimes with quality CMP materials.',
      fr: 'Zone de conflit intense. Épaves fraîches en grande quantité, avec parfois du CMP de qualité.',
    },
    resourceIds: ['Torite', 'Lindinium', 'Iron', 'Titanium', 'Copper'],
  },

  // ── Missions ───────────────────────────────────────────────────────────────
  {
    id: 'security-missions',
    name: 'Security Missions',
    system: 'Stanton',
    type: 'mission',
    efficiency: 'medium',
    description: {
      en: 'Bounty and escort missions offer CMR rewards as loot from high-value targets.',
      fr: 'Les missions bounty et d\'escorte offrent des récompenses CMR comme butin sur les cibles de haute valeur.',
    },
    resourceIds: ['Titanium', 'Copper', 'Taranite', 'Iron'],
  },
  {
    id: 'cargo-recovery',
    name: 'Cargo Recovery Missions',
    system: 'Stanton',
    type: 'mission',
    efficiency: 'medium',
    description: {
      en: 'Recovery and delivery missions. Mixed material rewards, ideal for filling gaps in your stockpile.',
      fr: 'Missions de récupération et livraison. Récompenses en matériaux mixtes, idéal pour compléter un stock.',
    },
    resourceIds: ['Iron', 'Aluminum', 'Silicon', 'Copper', 'Corundum'],
  },
  {
    id: 'nyx-raid-missions',
    name: 'Nyx Raids',
    system: 'Nyx',
    type: 'mission',
    efficiency: 'high',
    description: {
      en: 'Coordinated raid missions on Nyx installations. High risk, guaranteed CMR rewards.',
      fr: 'Missions de raid coordonnées sur les installations de Nyx. Risque élevé, récompenses CMR garanties.',
    },
    resourceIds: ['Torite', 'Lindinium', 'Stileron', 'Agricium', 'Ouratite'],
  },

  // ── Shop ───────────────────────────────────────────────────────────────────
  {
    id: 'refinery-shop',
    name: 'Refinery Shops',
    system: 'Stanton',
    type: 'shop',
    efficiency: 'low',
    description: {
      en: 'Refinery shops sell refined materials at a high price. Last resort if you\'re short on time.',
      fr: 'Les boutiques des raffineries vendent des matériaux raffinés à prix fort. Dernier recours si vous manquez de temps.',
    },
    resourceIds: ['Iron', 'Titanium', 'Aluminum', 'Copper', 'Silicon', 'Corundum'],
  },
];

export function getLocationsForResource(resourceName: string): FarmLocation[] {
  return FARM_LOCATIONS.filter((loc) => loc.resourceIds.includes(resourceName))
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.efficiency] - { high: 0, medium: 1, low: 2 }[b.efficiency]));
}
