import { prisma } from '@documenso/prisma';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { buildTeamWhereQuery } from '../../utils/teams';

export type GetApiTokensOptions = {
  userId: number;
  teamId: number;
};

/**
 * Team managers see every token of the team, other members only their own.
 */
export const getApiTokens = async ({ userId, teamId }: GetApiTokensOptions) => {
  const managedTeam = await prisma.team.findFirst({
    where: buildTeamWhereQuery({
      teamId,
      userId,
      roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
    }),
    select: {
      id: true,
    },
  });

  return await prisma.apiToken.findMany({
    where: {
      team: buildTeamWhereQuery({ teamId, userId }),
      ...(managedTeam ? {} : { userId }),
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      expires: true,
      lastUsedAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};
