import { useSession } from '@documenso/lib/client-only/providers/session';
import { trpc } from '@documenso/trpc/react';
import type { TeamSession } from '@documenso/trpc/server/organisation-router/get-organisation-session.types';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@documenso/ui/primitives/table';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';

import { TokenCreateDialog } from '~/components/dialogs/token-create-dialog';
import TokenDeleteDialog from '~/components/dialogs/token-delete-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`API Tokens`);
}

export default function AccountApiTokensPage() {
  const { organisations } = useSession();

  const teams = organisations.flatMap((organisation) =>
    organisation.teams.map((team) => ({ team, organisationName: organisation.name })),
  );

  return (
    <div>
      <SettingsHeader
        hideDivider
        title={<Trans>API Tokens</Trans>}
        subtitle={<Trans>Create your own API tokens. A token acts as you, with your role in its team.</Trans>}
      />

      <div className="space-y-10">
        {teams.map(({ team, organisationName }) => (
          <TeamApiTokens
            key={team.id}
            team={team}
            title={teams.length > 1 ? `${organisationName} · ${team.name}` : null}
          />
        ))}
      </div>
    </div>
  );
}

type TeamApiTokensProps = {
  team: TeamSession;

  /**
   * Shown when the user belongs to more than one team, so they know which team a token is for.
   */
  title: string | null;
};

const TeamApiTokens = ({ team, title }: TeamApiTokensProps) => {
  const { i18n } = useLingui();

  const {
    data: tokens,
    isLoading,
    isError,
  } = trpc.apiToken.getMany.useQuery({ teamId: team.id });

  return (
    <section className="space-y-4" data-testid={`team-api-tokens-${team.url}`}>
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold text-lg">{title ?? <Trans>Your tokens</Trans>}</h3>

        <TokenCreateDialog teamId={team.id} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Trans>Name</Trans>
            </TableHead>
            <TableHead>
              <Trans>Created</Trans>
            </TableHead>
            <TableHead>
              <Trans>Expires</Trans>
            </TableHead>
            <TableHead>
              <Trans>Last Used</Trans>
            </TableHead>
            <TableHead>
              <Trans>Actions</Trans>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                <Trans>Loading...</Trans>
              </TableCell>
            </TableRow>
          )}

          {isError && (
            <TableRow>
              <TableCell colSpan={5} className="text-destructive">
                <Trans>Something went wrong. Please try again later.</Trans>
              </TableCell>
            </TableRow>
          )}

          {tokens?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                <Trans>You have no API tokens yet. Your tokens will be shown here once you create them.</Trans>
              </TableCell>
            </TableRow>
          )}

          {tokens?.map((token) => (
            <TableRow key={token.id}>
              <TableCell className="font-medium">{token.name}</TableCell>
              <TableCell>{i18n.date(token.createdAt)}</TableCell>
              <TableCell>
                {!token.expires && (
                  <span className="text-muted-foreground">
                    <Trans>Never</Trans>
                  </span>
                )}

                {token.expires && token.expires < new Date() && (
                  <Badge variant="destructive" size="small">
                    <Trans>Expired</Trans>
                  </Badge>
                )}

                {token.expires && token.expires >= new Date() && i18n.date(token.expires)}
              </TableCell>
              <TableCell>
                {token.lastUsedAt ? (
                  i18n.date(token.lastUsedAt)
                ) : (
                  <span className="text-muted-foreground">
                    <Trans>Never</Trans>
                  </span>
                )}
              </TableCell>
              <TableCell>
                <TokenDeleteDialog token={token} teamId={team.id}>
                  <Button variant="destructive">
                    <Trans>Delete</Trans>
                  </Button>
                </TokenDeleteDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
};
