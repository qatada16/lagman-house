import React from 'react';
import { useRouter } from 'expo-router';
import { AppText, Badge, Button, Card, EmptyState, ListRow, Screen } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { listTemplates } from '@/features/receipts/templateRepo';

export default function TemplatesScreen() {
  const t = useT();
  const router = useRouter();
  const [templates] = useLocalQuery(() => listTemplates());

  return (
    <Screen safeTop={false} title={t('templatesTitle')} subtitle={t('templatesHint')} actions={<Button title={t('newTemplate')} variant="action" size="sm" icon="plus" onPress={() => router.push('/(admin)/templates/new')} />}>
      <Card padded={false}>
        {templates.length === 0 ? (
          <EmptyState title={t('noTemplates')} icon="file-text" />
        ) : (
          templates.map((tpl) => (
            <ListRow
              key={tpl.id}
              title={tpl.name}
              subtitle={`${tpl.config.paperWidthMm} mm`}
              chevron
              onPress={() => router.push({ pathname: '/(admin)/templates/[id]', params: { id: tpl.id } })}
              right={<Badge label={tpl.is_active ? t('active') : t('inactive')} tone={tpl.is_active ? 'success' : 'neutral'} />}
            />
          ))
        )}
      </Card>
      <AppText variant="small">{t('printerHint')}</AppText>
    </Screen>
  );
}
