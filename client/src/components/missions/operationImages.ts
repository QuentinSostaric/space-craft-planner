/** Real location references. Keep attribution with each remote image; no inferred maps. */
export interface OperationImage {
  url: string;
  source: string;
  credit: string;
  place: string;
  description: { en: string; fr: string };
  position?: string;
}
export const operationImages: Record<string, OperationImage> = {
  'qv-breaker': {
    url: 'https://media.starcitizen.tools/thumb/8/85/Rockcracker_QV_Breaker_stations.webp/1280px-Rockcracker_QV_Breaker_stations.webp',
    source: 'https://starcitizen.tools/File:Rockcracker_QV_Breaker_stations.webp', credit: 'CIG / RSI', place: 'QV Breaker Station',
    description: { en: 'Exterior of a QV Breaker mining station', fr: 'Vue extérieure d’une station de minage QV Breaker' },
  },
  'siege-of-orison': {
    url: 'https://media.starcitizen.tools/thumb/0/0b/Crusader-orison-inspiration-park-solanki-aerial.jpg/1280px-Crusader-orison-inspiration-park-solanki-aerial.jpg.webp',
    source: 'https://starcitizen.tools/File:Crusader-orison-inspiration-park-solanki-aerial.jpg', credit: 'Jonrellim · CC BY-SA 4.0', place: 'Solanki · Inspiration Park',
    description: { en: 'Aerial view of the Solanki platform in Orison', fr: 'Vue aérienne de la plateforme Solanki à Orison' },
  },
  'tactical-strike-groups': {
    url: 'https://media.starcitizen.tools/1/15/QV_Extraction_Station_entrance.webp',
    source: 'https://starcitizen.tools/File:QV_Extraction_Station_entrance.webp', credit: 'CIG / RSI', place: 'QV Extraction Station',
    description: { en: 'Gladius fighters at the extraction station entrance', fr: 'Chasseurs Gladius devant l’entrée de la station d’extraction' },
  },
  'asd-onyx': {
    url: 'https://media.starcitizen.tools/4/4d/Outside-asd-delving-2.webp',
    source: 'https://starcitizen.tools/File:Outside-asd-delving-2.webp', credit: 'CIG / RSI', place: 'ASD Onyx',
    description: { en: 'Surface approach to an ASD Onyx facility', fr: 'Approche d’une installation ASD Onyx depuis la surface' },
  },
  'storm-breaker': {
    url: 'https://media.starcitizen.tools/thumb/0/03/Farro_Data_Center_VII%2C_Pyro_IV.webp/1280px-Farro_Data_Center_VII%2C_Pyro_IV.webp',
    source: 'https://starcitizen.tools/File:Farro_Data_Center_VII,_Pyro_IV.webp', credit: 'T00dled00 · CC BY-SA 4.0', place: 'Farro Data Center VII',
    description: { en: 'Farro Data Center VII on the surface', fr: 'Le complexe Farro Data Center VII à la surface' },
  },
  hathor: {
    url: 'https://media.starcitizen.tools/thumb/b/be/CloudImperiumGames_SneakPeek_3142025.png/1280px-CloudImperiumGames_SneakPeek_3142025.png.webp',
    source: 'https://starcitizen.tools/File:CloudImperiumGames_SneakPeek_3142025.png', credit: 'CIG / RSI', place: 'Hathor Group',
    description: { en: 'Abandoned industrial building bearing the Hathor Group insignia', fr: 'Bâtiment industriel abandonné portant l’identité Hathor Group' },
  },
  jumptown: {
    url: 'https://media.starcitizen.tools/thumb/d/db/Jumptown-daymar.webp/1280px-Jumptown-daymar.webp',
    source: 'https://starcitizen.tools/File:Jumptown-daymar.webp', credit: 'CIG / RSI', place: 'Jumptown · Daymar',
    description: { en: 'Jumptown drug lab on Daymar', fr: 'Laboratoire de drogue Jumptown sur Daymar' },
  },
};
export const qvLaserImage: OperationImage = {
  url: 'https://media.starcitizen.tools/1/1a/Rockcracker_laser_QV_Breaker_stations.webp',
  source: 'https://starcitizen.tools/File:Rockcracker_laser_QV_Breaker_stations.webp', credit: 'CIG / RSI', place: 'QV Breaker · Mining laser',
  description: { en: 'QV Breaker laser firing at an asteroid', fr: 'Le laser de QV Breaker en action sur un astéroïde' },
};
export const orisonStepImages: Record<string, OperationImage> = {
  hartmoore: {
    url: 'https://media.starcitizen.tools/thumb/a/a9/Crusader-orison-inspiration-park-hartmoore-aerial.jpg/1280px-Crusader-orison-inspiration-park-hartmoore-aerial.jpg.webp',
    source: 'https://starcitizen.tools/File:Crusader-orison-inspiration-park-hartmoore-aerial.jpg', credit: 'Jonrellim · CC BY-SA 4.0', place: 'Hartmoore · Inspiration Park',
    description: { en: 'Aerial view of the Hartmoore platform in Orison', fr: 'Vue aérienne de la plateforme Hartmoore à Orison' },
  },
  barge: {
    url: 'https://media.starcitizen.tools/thumb/0/0a/Crusader-orison-inspiration-admin-center-aerial.jpg/1280px-Crusader-orison-inspiration-admin-center-aerial.jpg.webp',
    source: 'https://starcitizen.tools/File:Crusader-orison-inspiration-admin-center-aerial.jpg', credit: 'Jonrellim · CC BY-SA 4.0', place: 'Admin Center · Inspiration Park',
    description: { en: 'Aerial view of the Admin Center in Orison', fr: 'Vue aérienne de l’Admin Center à Orison' },
  },
};
