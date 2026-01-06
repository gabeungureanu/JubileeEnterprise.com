/**
 * EngagementCategory Model
 * Handles hierarchical category taxonomy for organizing engagement rules.
 * Supports up to 5 levels of depth with safe deletion policies.
 *
 * DELETION POLICY:
 * - REASSIGN: Move children to deleted node's parent (default)
 * - CASCADE: Soft-delete all descendants recursively
 * - BLOCK: Prevent deletion if children exist
 *
 * Rules are NEVER orphaned - category_id becomes NULL on delete.
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// ============================================
// Row Conversion Functions
// ============================================

/**
 * Convert database row to Category object
 */
function rowToCategory(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    parentId: row.parent_id,
    depth: row.depth,
    path: row.path,
    sortOrder: row.sort_order,
    icon: row.icon,
    color: row.color,
    isActive: row.is_active,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Computed fields if joined
    ruleCount: row.rule_count !== undefined ? parseInt(row.rule_count, 10) : undefined,
    childCount: row.child_count !== undefined ? parseInt(row.child_count, 10) : undefined,
    parentName: row.parent_name,
    parentSlug: row.parent_slug
  };
}

// ============================================
// Read Operations
// ============================================

/**
 * Find category by ID
 */
async function findById(categoryId) {
  const result = await database.query(
    `SELECT ec.*, parent.name as parent_name, parent.slug as parent_slug,
     (SELECT COUNT(*) FROM hospitality_rules WHERE category_id = ec.id) as rule_count,
     (SELECT COUNT(*) FROM engagement_categories WHERE parent_id = ec.id AND is_deleted = FALSE) as child_count
     FROM engagement_categories ec
     LEFT JOIN engagement_categories parent ON ec.parent_id = parent.id
     WHERE ec.id = $1 AND ec.is_deleted = FALSE`,
    [categoryId]
  );
  return rowToCategory(result.rows[0]);
}

/**
 * Find category by slug (optionally within a parent scope)
 */
async function findBySlug(slug, parentId = null) {
  const result = await database.query(
    `SELECT ec.*, parent.name as parent_name, parent.slug as parent_slug,
     (SELECT COUNT(*) FROM hospitality_rules WHERE category_id = ec.id) as rule_count,
     (SELECT COUNT(*) FROM engagement_categories WHERE parent_id = ec.id AND is_deleted = FALSE) as child_count
     FROM engagement_categories ec
     LEFT JOIN engagement_categories parent ON ec.parent_id = parent.id
     WHERE ec.slug = $1 AND ec.is_deleted = FALSE
     AND (ec.parent_id IS NOT DISTINCT FROM $2)`,
    [slug, parentId]
  );
  return rowToCategory(result.rows[0]);
}

/**
 * Find all root categories (depth = 0)
 */
async function findRoots(includeInactive = false) {
  let query = `
    SELECT ec.*,
    (SELECT COUNT(*) FROM hospitality_rules WHERE category_id = ec.id) as rule_count,
    (SELECT COUNT(*) FROM engagement_categories WHERE parent_id = ec.id AND is_deleted = FALSE) as child_count
    FROM engagement_categories ec
    WHERE ec.parent_id IS NULL AND ec.is_deleted = FALSE
  `;

  if (!includeInactive) {
    query += ` AND ec.is_active = TRUE`;
  }

  query += ` ORDER BY ec.sort_order, ec.name`;

  const result = await database.query(query);
  return result.rows.map(rowToCategory);
}

/**
 * Find children of a category
 */
async function findChildren(parentId, includeInactive = false) {
  let query = `
    SELECT ec.*,
    (SELECT COUNT(*) FROM hospitality_rules WHERE category_id = ec.id) as rule_count,
    (SELECT COUNT(*) FROM engagement_categories WHERE parent_id = ec.id AND is_deleted = FALSE) as child_count
    FROM engagement_categories ec
    WHERE ec.parent_id = $1 AND ec.is_deleted = FALSE
  `;

  if (!includeInactive) {
    query += ` AND ec.is_active = TRUE`;
  }

  query += ` ORDER BY ec.sort_order, ec.name`;

  const result = await database.query(query, [parentId]);
  return result.rows.map(rowToCategory);
}

/**
 * Get full category tree (all categories organized hierarchically)
 * Returns flat list with depth info for easy tree rendering
 */
async function getFullTree(includeInactive = false) {
  let query = `
    WITH RECURSIVE category_tree AS (
      -- Base case: root categories
      SELECT ec.*, 0 as tree_order,
             ARRAY[LPAD(ec.sort_order::text, 5, '0') || '_' || ec.name] as sort_path
      FROM engagement_categories ec
      WHERE ec.parent_id IS NULL AND ec.is_deleted = FALSE
      ${includeInactive ? '' : 'AND ec.is_active = TRUE'}

      UNION ALL

      -- Recursive case: children
      SELECT child.*, ct.tree_order + 1,
             ct.sort_path || ARRAY[LPAD(child.sort_order::text, 5, '0') || '_' || child.name]
      FROM engagement_categories child
      INNER JOIN category_tree ct ON child.parent_id = ct.id
      WHERE child.is_deleted = FALSE
      ${includeInactive ? '' : 'AND child.is_active = TRUE'}
    )
    SELECT ct.*,
           parent.name as parent_name,
           parent.slug as parent_slug,
           (SELECT COUNT(*) FROM hospitality_rules WHERE category_id = ct.id) as rule_count,
           (SELECT COUNT(*) FROM engagement_categories WHERE parent_id = ct.id AND is_deleted = FALSE) as child_count
    FROM category_tree ct
    LEFT JOIN engagement_categories parent ON ct.parent_id = parent.id
    ORDER BY ct.sort_path
  `;

  const result = await database.query(query);
  return result.rows.map(rowToCategory);
}

/**
 * Get category ancestors (path from root to category)
 */
async function getAncestors(categoryId) {
  const result = await database.query(`
    WITH RECURSIVE ancestors AS (
      SELECT ec.*, 0 as distance
      FROM engagement_categories ec
      WHERE ec.id = $1 AND ec.is_deleted = FALSE

      UNION ALL

      SELECT parent.*, a.distance + 1
      FROM engagement_categories parent
      INNER JOIN ancestors a ON a.parent_id = parent.id
      WHERE parent.is_deleted = FALSE
    )
    SELECT * FROM ancestors
    WHERE id != $1
    ORDER BY distance DESC
  `, [categoryId]);

  return result.rows.map(rowToCategory);
}

/**
 * Get all descendants of a category (subtree)
 */
async function getDescendants(categoryId) {
  const result = await database.query(`
    WITH RECURSIVE descendants AS (
      SELECT ec.*, 0 as distance
      FROM engagement_categories ec
      WHERE ec.parent_id = $1 AND ec.is_deleted = FALSE

      UNION ALL

      SELECT child.*, d.distance + 1
      FROM engagement_categories child
      INNER JOIN descendants d ON child.parent_id = d.id
      WHERE child.is_deleted = FALSE
    )
    SELECT d.*,
           (SELECT COUNT(*) FROM hospitality_rules WHERE category_id = d.id) as rule_count,
           (SELECT COUNT(*) FROM engagement_categories WHERE parent_id = d.id AND is_deleted = FALSE) as child_count
    FROM descendants d
    ORDER BY d.distance, d.sort_order, d.name
  `, [categoryId]);

  return result.rows.map(rowToCategory);
}

/**
 * Search categories by name
 */
async function search(searchTerm, limit = 20) {
  const result = await database.query(`
    SELECT ec.*,
           parent.name as parent_name,
           parent.slug as parent_slug,
           (SELECT COUNT(*) FROM hospitality_rules WHERE category_id = ec.id) as rule_count,
           (SELECT COUNT(*) FROM engagement_categories WHERE parent_id = ec.id AND is_deleted = FALSE) as child_count
    FROM engagement_categories ec
    LEFT JOIN engagement_categories parent ON ec.parent_id = parent.id
    WHERE ec.is_deleted = FALSE
      AND (ec.name ILIKE $1 OR ec.description ILIKE $1 OR ec.slug ILIKE $1)
    ORDER BY
      CASE WHEN ec.name ILIKE $2 THEN 0 ELSE 1 END,
      ec.depth, ec.sort_order, ec.name
    LIMIT $3
  `, [`%${searchTerm}%`, `${searchTerm}%`, limit]);

  return result.rows.map(rowToCategory);
}

// ============================================
// Write Operations
// ============================================

/**
 * Create a new category
 */
async function create(categoryData) {
  const id = uuidv4();

  // Calculate depth based on parent
  let depth = 0;
  let path = '/' + id;

  if (categoryData.parentId) {
    const parent = await findById(categoryData.parentId);
    if (!parent) {
      throw new Error('Parent category not found');
    }
    depth = parent.depth + 1;
    if (depth > 4) {
      throw new Error('Maximum category depth (5 levels) exceeded');
    }
    path = parent.path + '/' + id;
  }

  // Validate slug uniqueness within parent scope
  const existing = await findBySlug(categoryData.slug, categoryData.parentId || null);
  if (existing) {
    throw new Error(`Slug "${categoryData.slug}" already exists at this level`);
  }

  const result = await database.query(
    `INSERT INTO engagement_categories
     (id, slug, name, description, parent_id, depth, path, sort_order, icon, color, is_active, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      id,
      categoryData.slug,
      categoryData.name,
      categoryData.description || null,
      categoryData.parentId || null,
      depth,
      path,
      categoryData.sortOrder || 0,
      categoryData.icon || null,
      categoryData.color || '#9a9a9a',
      categoryData.isActive !== false,
      categoryData.createdBy || null
    ]
  );

  logger.info('Category created', { categoryId: id, slug: categoryData.slug, parentId: categoryData.parentId });
  return rowToCategory(result.rows[0]);
}

/**
 * Update a category
 */
async function update(categoryId, updates, updatedBy = null) {
  const category = await findById(categoryId);
  if (!category) {
    throw new Error('Category not found');
  }

  // If changing parent, validate depth and update path
  if (updates.parentId !== undefined && updates.parentId !== category.parentId) {
    let newDepth = 0;
    let newPath = '/' + categoryId;

    if (updates.parentId) {
      // Prevent moving to own descendant
      const descendants = await getDescendants(categoryId);
      if (descendants.some(d => d.id === updates.parentId)) {
        throw new Error('Cannot move category to its own descendant');
      }

      const newParent = await findById(updates.parentId);
      if (!newParent) {
        throw new Error('New parent category not found');
      }
      newDepth = newParent.depth + 1;

      // Check if max depth would be exceeded for this category or descendants
      const maxDescendantDepth = Math.max(0, ...descendants.map(d => d.depth - category.depth));
      if (newDepth + maxDescendantDepth > 4) {
        throw new Error('Moving would exceed maximum depth (5 levels)');
      }

      newPath = newParent.path + '/' + categoryId;
    }

    updates.depth = newDepth;
    updates.path = newPath;

    // Update descendants' depth and path
    const descendants = await getDescendants(categoryId);
    for (const desc of descendants) {
      const depthDelta = newDepth - category.depth;
      const newDescPath = newPath + desc.path.substring(category.path.length);
      await database.query(
        `UPDATE engagement_categories SET depth = depth + $1, path = $2, updated_at = NOW() WHERE id = $3`,
        [depthDelta, newDescPath, desc.id]
      );
    }
  }

  // If changing slug, validate uniqueness
  if (updates.slug && updates.slug !== category.slug) {
    const parentId = updates.parentId !== undefined ? updates.parentId : category.parentId;
    const existing = await findBySlug(updates.slug, parentId);
    if (existing) {
      throw new Error(`Slug "${updates.slug}" already exists at this level`);
    }
  }

  const fieldMap = {
    slug: 'slug',
    name: 'name',
    description: 'description',
    parentId: 'parent_id',
    depth: 'depth',
    path: 'path',
    sortOrder: 'sort_order',
    icon: 'icon',
    color: 'color',
    isActive: 'is_active'
  };

  const dbUpdates = { updated_by: updatedBy };
  for (const [key, value] of Object.entries(updates)) {
    if (fieldMap[key]) {
      dbUpdates[fieldMap[key]] = value;
    }
  }

  const fields = Object.keys(dbUpdates);
  const values = Object.values(dbUpdates);

  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');

  const result = await database.query(
    `UPDATE engagement_categories
     SET ${setClause}, updated_at = NOW()
     WHERE id = $1 AND is_deleted = FALSE
     RETURNING *`,
    [categoryId, ...values]
  );

  logger.info('Category updated', { categoryId, updates: Object.keys(updates) });
  return rowToCategory(result.rows[0]);
}

/**
 * Safe delete a category with specified mode
 * @param {string} categoryId - Category to delete
 * @param {string} mode - 'reassign' | 'cascade' | 'block'
 * @param {string} deletedBy - User ID performing deletion
 */
async function safeDelete(categoryId, mode = 'reassign', deletedBy = null) {
  const category = await findById(categoryId);
  if (!category) {
    return { success: false, message: 'Category not found', affectedRules: 0, affectedChildren: 0 };
  }

  // Count children and rules
  const children = await findChildren(categoryId, true);
  const childCount = children.length;

  const rulesResult = await database.query(
    'SELECT COUNT(*) as count FROM hospitality_rules WHERE category_id = $1',
    [categoryId]
  );
  const ruleCount = parseInt(rulesResult.rows[0].count, 10);

  // Handle based on mode
  if (mode === 'block' && (childCount > 0 || ruleCount > 0)) {
    return {
      success: false,
      message: `Cannot delete: ${childCount} children and ${ruleCount} rules exist. Move them first.`,
      affectedRules: ruleCount,
      affectedChildren: childCount
    };
  }

  if (mode === 'reassign') {
    // Move children to parent (or make them root)
    await database.query(
      `UPDATE engagement_categories
       SET parent_id = $1, updated_at = NOW()
       WHERE parent_id = $2 AND is_deleted = FALSE`,
      [category.parentId, categoryId]
    );

    // Move rules to parent category (or NULL)
    await database.query(
      `UPDATE hospitality_rules
       SET category_id = $1, updated_at = NOW()
       WHERE category_id = $2`,
      [category.parentId, categoryId]
    );

    // Recalculate depth and path for reassigned children
    const reassignedChildren = await findChildren(category.parentId, true);
    for (const child of reassignedChildren) {
      if (child.path.includes(categoryId)) {
        const newDepth = category.parentId ? category.depth : 0;
        const newPath = category.parentId
          ? (await findById(category.parentId)).path + '/' + child.id
          : '/' + child.id;

        await database.query(
          `UPDATE engagement_categories SET depth = $1, path = $2, updated_at = NOW() WHERE id = $3`,
          [newDepth, newPath, child.id]
        );
      }
    }

  } else if (mode === 'cascade') {
    // Soft-delete all descendants
    const descendants = await getDescendants(categoryId);
    for (const desc of descendants) {
      await database.query(
        `UPDATE engagement_categories
         SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $1
         WHERE id = $2`,
        [deletedBy, desc.id]
      );

      // Move rules from deleted category to NULL
      await database.query(
        `UPDATE hospitality_rules SET category_id = NULL, updated_at = NOW() WHERE category_id = $1`,
        [desc.id]
      );
    }

    // Move rules from main category to NULL
    await database.query(
      `UPDATE hospitality_rules SET category_id = NULL, updated_at = NOW() WHERE category_id = $1`,
      [categoryId]
    );
  }

  // Soft-delete the category
  await database.query(
    `UPDATE engagement_categories
     SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $1
     WHERE id = $2`,
    [deletedBy, categoryId]
  );

  logger.info('Category deleted', { categoryId, mode, affectedRules: ruleCount, affectedChildren: childCount });

  return {
    success: true,
    message: 'Category deleted successfully',
    affectedRules: ruleCount,
    affectedChildren: childCount
  };
}

/**
 * Restore a soft-deleted category
 */
async function restore(categoryId, restoredBy = null) {
  const result = await database.query(
    `UPDATE engagement_categories
     SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, updated_by = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [restoredBy, categoryId]
  );

  if (result.rows.length === 0) {
    throw new Error('Category not found');
  }

  logger.info('Category restored', { categoryId });
  return rowToCategory(result.rows[0]);
}

/**
 * Reorder categories within a parent
 */
async function reorder(parentId, orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    await database.query(
      `UPDATE engagement_categories SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
      [i, orderedIds[i]]
    );
  }

  logger.info('Categories reordered', { parentId, count: orderedIds.length });
  return true;
}

// ============================================
// Statistics
// ============================================

/**
 * Get category statistics
 */
async function getStats() {
  const result = await database.query(`
    SELECT
      COUNT(*) FILTER (WHERE is_deleted = FALSE) as total_categories,
      COUNT(*) FILTER (WHERE is_deleted = FALSE AND depth = 0) as root_count,
      COUNT(*) FILTER (WHERE is_deleted = FALSE AND depth = 1) as level2_count,
      COUNT(*) FILTER (WHERE is_deleted = FALSE AND depth = 2) as level3_count,
      COUNT(*) FILTER (WHERE is_deleted = FALSE AND depth = 3) as level4_count,
      COUNT(*) FILTER (WHERE is_deleted = FALSE AND depth = 4) as level5_count,
      COUNT(*) FILTER (WHERE is_deleted = FALSE AND is_active = FALSE) as inactive_count,
      COUNT(*) FILTER (WHERE is_deleted = TRUE) as deleted_count,
      MAX(depth) as max_depth
    FROM engagement_categories
  `);

  const rulesResult = await database.query(`
    SELECT
      COUNT(*) FILTER (WHERE category_id IS NOT NULL) as categorized_rules,
      COUNT(*) FILTER (WHERE category_id IS NULL) as uncategorized_rules
    FROM hospitality_rules
  `);

  return {
    ...result.rows[0],
    ...rulesResult.rows[0]
  };
}

/**
 * Get categories with most rules
 */
async function getTopCategories(limit = 10) {
  const result = await database.query(`
    SELECT ec.*,
           parent.name as parent_name,
           COUNT(hr.id) as rule_count
    FROM engagement_categories ec
    LEFT JOIN engagement_categories parent ON ec.parent_id = parent.id
    LEFT JOIN hospitality_rules hr ON hr.category_id = ec.id
    WHERE ec.is_deleted = FALSE
    GROUP BY ec.id, parent.name
    ORDER BY rule_count DESC
    LIMIT $1
  `, [limit]);

  return result.rows.map(rowToCategory);
}

// ============================================
// Module Exports
// ============================================

module.exports = {
  // Read
  findById,
  findBySlug,
  findRoots,
  findChildren,
  getFullTree,
  getAncestors,
  getDescendants,
  search,

  // Write
  create,
  update,
  safeDelete,
  restore,
  reorder,

  // Statistics
  getStats,
  getTopCategories
};
