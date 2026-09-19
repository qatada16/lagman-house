import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Input, ListRow, Sheet, IconButton, EmptyState } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { deleteCategory, listCategories, saveCategory } from './menuRepo';
import { confirm } from '@/lib/confirm';
import type { Category } from '@/lib/types';

export function CategoryManager({ visible, onClose, onChanged }: { visible: boolean; onClose: () => void; onChanged: () => void }) {
  const t = useT();
  const { row } = useLayout();
  const [items, setItems] = useState<Category[]>(() => listCategories(true));
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [name, setName] = useState('');
  const [nameUr, setNameUr] = useState('');

  const reload = () => {
    setItems(listCategories(true));
    onChanged();
  };

  const startEdit = (c?: Category) => {
    setEditing(c ?? {});
    setName(c?.name ?? '');
    setNameUr(c?.name_ur ?? '');
  };

  const save = () => {
    if (!name.trim()) return;
    saveCategory({ id: editing?.id, name, name_ur: nameUr });
    setEditing(null);
    reload();
  };

  const remove = async (c: Category) => {
    if (await confirm(t('delete'), t('deleteCategoryConfirm', { name: c.name }), t('delete'), t('cancel'), true)) {
      deleteCategory(c.id);
      reload();
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('manageCategories')}>
      {editing ? (
        <View style={{ gap: spacing.sm }}>
          <Input label={t('categoryName')} value={name} onChangeText={setName} autoFocus />
          <Input label={t('categoryNameUr')} value={nameUr} onChangeText={setNameUr} />
          <View style={[row, { gap: spacing.sm }]}>
            <Button title={t('save')} onPress={save} style={{ flex: 1 }} />
            <Button title={t('cancel')} variant="ghost" onPress={() => setEditing(null)} />
          </View>
        </View>
      ) : (
        <Button title={t('newCategory')} icon="plus" variant="outline" onPress={() => startEdit()} />
      )}
      {items.length === 0 ? (
        <EmptyState title={t('noCategory')} icon="tag" />
      ) : (
        items.map((c) => (
          <ListRow
            key={c.id}
            title={c.name}
            subtitle={c.name_ur ?? undefined}
            onPress={() => startEdit(c)}
            right={<IconButton icon="trash-2" color={colors.danger} onPress={() => remove(c)} />}
            style={{ paddingHorizontal: spacing.sm }}
          />
        ))
      )}
    </Sheet>
  );
}
