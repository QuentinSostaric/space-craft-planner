import { expect, test } from '@playwright/test';
import { emptyDataset, installDeterministicState } from './fixtures';

test('the initial library keeps obtainable blueprints and orders exact introduction builds newest first', async ({ page }) => {
  const errors = await installDeterministicState(page);
  const blueprint = (id: string, name: string, introducedInBuild?: string) => ({
    id, name, introducedInBuild, introductionIsBaseline: false,
    manufacturer: 'Behring', category: 'fps-weapon', craftTimeSecs: 60,
    baseStats: {}, slots: [], detailsLoaded: true,
  });
  const obtainable=['old','z','b','unknown'].map(id=>({blueprint:{id},contractCount:1,factionCount:1,localityCount:0,dropScore:1,maxReputation:0,derivedScales:[],localities:[],standings:[],factions:[]}));
  const dataset = { ...emptyDataset, datasetId: 'recency-test', blueprintCount: 5,
    missionRewards: { factionGroups:[], blueprintAcquisitionGraph:obtainable },
    blueprints: [blueprint('old','Alpha old','9'),blueprint('z','Zulu newest','100'),
      blueprint('unknown','Legacy unknown'),blueprint('b','Beta newest','100'),blueprint('not-obtainable','Hidden newer','999')] };
  await page.route('**/api/game-data/public**', async route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path === '/api/game-data/public'
      ? { datasets: [dataset], defaultChannel: 'live' } : { dataset } });
  });
  await page.goto('/blueprints');
  const list=page.getByRole('list',{name:'Blueprint list',exact:true});
  await expect(list.getByRole('link')).toHaveCount(4);
  if ((page.viewportSize()?.width ?? 0) >= 900) {
    await expect(page.getByRole('region',{name:'Blueprint filters'}).getByText('Newest first',{exact:true}).filter({visible:true})).toBeVisible();
  }
  const hrefs=await list.getByRole('link').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
  await expect(list.getByRole('link',{name:/Hidden newer/})).toHaveCount(0);
  expect(hrefs).toEqual(['/item/beta-newest','/item/zulu-newest','/item/alpha-old','/item/legacy-unknown']);
  await expect(list.getByText('Catalogue since build 100',{exact:true})).toHaveCount(2);
  expect(errors).toEqual([]);
});
