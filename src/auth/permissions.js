export const ROLES = {
  admin: 'Администратор',
  manager: 'Менеджер',
  picker: 'Сборщик'
};

export const PERMISSIONS = [
  { id: 'warehouse.edit', label: 'Редактирование склада' },
  { id: 'inventory.view', label: 'Просмотр учета склада' },
  { id: 'deliveries.manage', label: 'Заявки на поставки' },
  { id: 'transfers.manage', label: 'Заявки на перемещение' },
  { id: 'revisions.manage', label: 'Ревизии' },
  { id: 'nomenclature.manage', label: 'Учет номенклатуры' },
  { id: 'users.manage', label: 'Управление сотрудниками' }
];

const ROLE_DEFAULTS = {
  admin: PERMISSIONS.map(permission => permission.id),
  manager: [
    'warehouse.edit', 'inventory.view', 'deliveries.manage',
    'transfers.manage', 'revisions.manage', 'nomenclature.manage'
  ],
  picker: ['inventory.view']
};

export function defaultPermissions(role) {
  return [...(ROLE_DEFAULTS[role] || [])];
}

export function hasPermission(user, permission) {
  if (!user) return false;
  return user.role === 'admin' || (user.permissions || []).includes(permission);
}

export function roleName(role) {
  return ROLES[role] || role;
}
