import { EmptyState, Link, Text } from '@hubspot/ui-extensions';
import { hubspot } from '@hubspot/ui-extensions';

hubspot.extend<'settings'>(() => <SettingsPage />);

const SettingsPage = () => {
  const chatClanIntegrationsLink =
    'https://chatclan.tfpdigital.co.za/dashboard#integrations';

  return (
    <>
      <EmptyState
        title="Manage this connection in ChatClan"
        layout="horizontal"
        imageName="building"
      >
        <Text>
          Review contact field mappings, synchronisation history, consent
          handling, connection health, and recovery controls in your{' '}
          <Link href={chatClanIntegrationsLink}>ChatClan integrations workspace</Link>.
        </Text>
      </EmptyState>
    </>
  );
};
