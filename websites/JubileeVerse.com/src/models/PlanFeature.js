/**
 * PlanFeature Model
 * Handles database operations for subscription plan features
 */

const db = require('../database');

// Row conversion functions
function rowToCategory(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    displayOrder: row.display_order,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToFeature(row) {
  if (!row) return null;
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    name: row.name,
    slug: row.slug,
    description: row.description,
    displayOrder: row.display_order,
    isPublished: row.is_published,
    freePlan: row.free_plan,
    standardPlan: row.standard_plan,
    ministryPlan: row.ministry_plan,
    businessPlan: row.business_plan,
    freeValue: row.free_value,
    standardValue: row.standard_value,
    ministryValue: row.ministry_value,
    businessValue: row.business_value,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const PlanFeature = {
  /**
   * Get all categories with their features
   * @param {boolean} publishedOnly - If true, only return published items
   */
  async getAllWithFeatures(publishedOnly = true) {
    const categoryFilter = publishedOnly ? 'WHERE c.is_published = true' : '';
    const featureFilter = publishedOnly ? 'AND f.is_published = true' : '';

    const categoriesResult = await db.query(`
      SELECT * FROM plan_feature_categories c
      ${categoryFilter}
      ORDER BY c.display_order ASC
    `);

    const featuresResult = await db.query(`
      SELECT f.*, c.name as category_name, c.slug as category_slug
      FROM plan_features f
      JOIN plan_feature_categories c ON f.category_id = c.id
      ${publishedOnly ? 'WHERE f.is_published = true AND c.is_published = true' : ''}
      ORDER BY c.display_order ASC, f.display_order ASC
    `);

    const categories = categoriesResult.rows.map(rowToCategory);
    const features = featuresResult.rows.map(rowToFeature);

    // Group features by category
    return categories.map(category => ({
      ...category,
      features: features.filter(f => f.categoryId === category.id)
    }));
  },

  /**
   * Get all features (flat list)
   */
  async getAll(publishedOnly = true) {
    const filter = publishedOnly ? 'WHERE f.is_published = true AND c.is_published = true' : '';

    const result = await db.query(`
      SELECT f.*, c.name as category_name, c.slug as category_slug
      FROM plan_features f
      JOIN plan_feature_categories c ON f.category_id = c.id
      ${filter}
      ORDER BY c.display_order ASC, f.display_order ASC
    `);

    return result.rows.map(rowToFeature);
  },

  /**
   * Get a single feature by ID
   */
  async findById(id) {
    const result = await db.query(`
      SELECT f.*, c.name as category_name, c.slug as category_slug
      FROM plan_features f
      JOIN plan_feature_categories c ON f.category_id = c.id
      WHERE f.id = $1
    `, [id]);

    return rowToFeature(result.rows[0]);
  },

  /**
   * Update a feature's published status
   */
  async updatePublished(id, isPublished) {
    const result = await db.query(`
      UPDATE plan_features
      SET is_published = $2
      WHERE id = $1
      RETURNING *
    `, [id, isPublished]);

    if (result.rows.length === 0) return null;

    // Fetch with category info
    return this.findById(id);
  },

  /**
   * Update a feature
   */
  async update(id, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = [
      'name', 'description', 'display_order', 'is_published',
      'free_plan', 'standard_plan', 'ministry_plan', 'business_plan',
      'free_value', 'standard_value', 'ministry_value', 'business_value'
    ];

    // Map camelCase to snake_case
    const fieldMap = {
      name: 'name',
      description: 'description',
      displayOrder: 'display_order',
      isPublished: 'is_published',
      freePlan: 'free_plan',
      standardPlan: 'standard_plan',
      ministryPlan: 'ministry_plan',
      businessPlan: 'business_plan',
      freeValue: 'free_value',
      standardValue: 'standard_value',
      ministryValue: 'ministry_value',
      businessValue: 'business_value'
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (data[key] !== undefined && allowedFields.includes(dbField)) {
        fields.push(`${dbField} = $${paramIndex}`);
        values.push(data[key]);
        paramIndex++;
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);

    await db.query(`
      UPDATE plan_features
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
    `, values);

    return this.findById(id);
  },

  /**
   * Create a new feature
   */
  async create(data) {
    const result = await db.query(`
      INSERT INTO plan_features (
        category_id, name, slug, description, display_order, is_published,
        free_plan, standard_plan, ministry_plan, business_plan,
        free_value, standard_value, ministry_value, business_value
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `, [
      data.categoryId,
      data.name,
      data.slug,
      data.description || null,
      data.displayOrder || 0,
      data.isPublished !== false,
      data.freePlan || false,
      data.standardPlan || false,
      data.ministryPlan || false,
      data.businessPlan || false,
      data.freeValue || null,
      data.standardValue || null,
      data.ministryValue || null,
      data.businessValue || null
    ]);

    return this.findById(result.rows[0].id);
  },

  /**
   * Delete a feature
   */
  async delete(id) {
    const result = await db.query(`
      DELETE FROM plan_features WHERE id = $1 RETURNING id
    `, [id]);

    return result.rows.length > 0;
  },

  // Category operations

  /**
   * Get all categories
   */
  async getAllCategories(publishedOnly = true) {
    const filter = publishedOnly ? 'WHERE is_published = true' : '';

    const result = await db.query(`
      SELECT * FROM plan_feature_categories
      ${filter}
      ORDER BY display_order ASC
    `);

    return result.rows.map(rowToCategory);
  },

  /**
   * Update a category's published status
   */
  async updateCategoryPublished(id, isPublished) {
    const result = await db.query(`
      UPDATE plan_feature_categories
      SET is_published = $2
      WHERE id = $1
      RETURNING *
    `, [id, isPublished]);

    return rowToCategory(result.rows[0]);
  }
};

module.exports = PlanFeature;
