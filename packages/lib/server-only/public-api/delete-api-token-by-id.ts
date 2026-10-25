import { prisma } from '@documenso/prisma';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';

export type DeleteTokenByIdOptions = {
  id: number;
  userId: number;
  teamId: number;
};

/**
 * Team managers can delete any token of the team, other members only their own.
 */
export const deleteTokenById = async ({ id, userId, teamId }: DeleteTokenByIdOptions) => {
  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery({ teamId, userId }),
  });

  if (!team) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to delete this token',
    });
  }

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

  const { count } = await prisma.apiToken.deleteMany({
    where: {
      id,
      teamId,
      ...(managedTeam ? {} : { userId }),
    },
  });

  if (count === 0) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to delete this token',
    });
  }
};
