import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { expect, type Page, test } from '@playwright/test';
import { TeamMemberRole } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';

const createToken = async (page: Page, teamUrl: string, name: string) => {
  const section = page.getByTestId(`team-api-tokens-${teamUrl}`);

  await section.getByTestId('token-create-button').click();
  await page.getByTestId('token-name-input').fill(name);
  await page.getByTestId('token-create-submit').click();

  const token = await page.getByTestId('created-api-token').inputValue();

  await page.getByTestId('token-created-done').click();
  await expect(section.getByRole('cell', { name })).toBeVisible();

  return token;
};

test('[API_TOKENS]: a team member creates their own token and lists the team templates with it', async ({
  page,
  request,
}) => {
  const { owner, team } = await seedTeam();
  const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  await seedBlankTemplate(owner, team.id, { createTemplateOptions: { title: 'Shared template' } });

  await apiSignin({ page, email: member.email, redirectPath: '/settings/tokens' });

  const token = await createToken(page, team.url, 'Extension');
  expect(token).toMatch(/^api_/);

  const res = await request.get('/api/v2/template?perPage=100', {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.ok()).toBeTruthy();

  const { data } = await res.json();
  expect(data.map((template: { title: string }) => template.title)).toContain('Shared template');
});

test('[API_TOKENS]: a team member does not see the tokens of other members', async ({ page }) => {
  const { owner, team } = await seedTeam();
  const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  await apiSignin({ page, email: owner.email, redirectPath: '/settings/tokens' });
  await createToken(page, team.url, 'Owner token');

  await apiSignin({ page, email: member.email, redirectPath: '/settings/tokens' });

  const section = page.getByTestId(`team-api-tokens-${team.url}`);
  await expect(section.getByTestId('token-create-button')).toBeVisible();
  await expect(section.getByRole('cell', { name: 'Owner token' })).not.toBeVisible();
});
