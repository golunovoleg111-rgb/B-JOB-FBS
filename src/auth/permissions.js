export const ROLES = {
  admin: 'Администратор',
  manager: 'Менеджер',
  picker: 'Сборщик'
};

export const PERMISSIONS = [
  { id: 'warehouse.view', label: 'Просмотр карты склада' },
  { id: 'warehouse.edit', label: 'Редактирование склада' },
  { id: 'inventory.view', label: 'Просмотр учета склада' },
  { id: 'deliveries.view', label: 'Просмотр заявок на поставки' },
  { id: 'deliveries.manage', label: 'Управление поставками' },
  { id: 'transfers.view', label: 'Просмотр заявок на перемещение' },
  { id: 'transfers.manage', label: 'Управление перемещениями' },
  { id: 'revisions.view', label: 'Просмотр ревизий' },
  { id: 'revisions.manage', label: 'Управление ревизиями' },
  { id: 'nomenclature.view', label: 'Просмотр номенклатуры' },
  { id: 'nomenclature.manage', label: 'Учет номенклатуры' },
  { id: 'users.manage', label: 'Управление сотрудниками' }
];

const ROLE_DEFAULTS = {
  admin: PERMISSIONS.map(permission => permission.id),
  manager: [
    'warehouse.view', 'warehouse.edit', 'inventory.view',
    'deliveries.view', 'deliveries.manage', 'transfers.view', 'transfers.manage',
    'revisions.view', 'revisions.manage', 'nomenclature.view', 'nomenclature.manage'
  ],
  picker: ['warehouse.view', 'inventory.view', 'deliveries.view', 'transfers.view', 'revisions.view']
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
