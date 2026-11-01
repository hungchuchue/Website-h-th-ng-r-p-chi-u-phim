"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
exports.categoryRepository = {
    async getAllCategories(limit, offset, onlyEnabled, countryCode) {
        const queryParams = [limit, offset];
        const categoryCountryFilter = (paramIndex) => `(c.is_all_countries = true OR c.countries @> ARRAY[$${paramIndex}]::VARCHAR[])`;
        const buildWhereSql = () => {
            const whereParts = onlyEnabled ? ['c.is_enabled = TRUE'] : ['1=1'];
            return `WHERE ${whereParts.join(' AND ')}`;
        };
        const categoriesCountryParamIndex = countryCode ? 3 : undefined;
        const whereSql = buildWhereSql();
        const countWhereSql = buildWhereSql();
        const countrySortSql = categoriesCountryParamIndex
            ? `CASE WHEN ${categoryCountryFilter(categoriesCountryParamIndex)} THEN 0 ELSE 1 END ASC,`
            : '';
        if (countryCode)
            queryParams.push(countryCode);
        const categoriesQuery = `SELECT c.*, 
            COALESCE((
                SELECT COUNT(*)::int
                FROM template_categories tc
                JOIN templates t ON t.id = tc.template_id
                WHERE tc.category_slug = c.slug
                  AND tc.is_enabled = TRUE
            ), 0) as templates_number 
            FROM categories c 
            ${whereSql}
            ORDER BY ${countrySortSql} c.sort_order ASC
            LIMIT $1 OFFSET $2`;
        const countQuery = `SELECT COUNT(*) FROM categories c ${countWhereSql}`;
        const [categoryResult, countResult] = await Promise.all([
            database_1.default.query(categoriesQuery, queryParams),
            database_1.default.query(countQuery)
        ]);
        return {
            categories: categoryResult.rows,
            total: parseInt(countResult.rows[0].count, 10)
        };
    },
    async createCategory(reqBody, slug) {
        const result = await database_1.default.query(`INSERT INTO categories (name, slug, sort_order, localized_names, is_enabled, is_all_countries, countries) 
             VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories), $3, $4, $5, $6) 
             RETURNING *`, [
            reqBody.name,
            slug,
            reqBody.localized_names || null,
            reqBody.is_enabled,
            reqBody.is_all_countries,
            reqBody.is_all_countries ? null : reqBody.countries || null
        ]);
        return result.rows[0];
    },
    async getCategoryById(id) {
        const result = await database_1.default.query(`SELECT c.*, 
            COALESCE((
                SELECT COUNT(*)::int
                FROM template_categories tc
                JOIN templates t ON t.id = tc.template_id
                WHERE tc.category_slug = c.slug
                  AND tc.is_enabled = TRUE
            ), 0) as templates_number 
            FROM categories c WHERE c.id = $1`, [id]);
        return result.rows[0] || null;
    },
    async getCategoryBySlug(slug) {
        const result = await database_1.default.query(`SELECT c.*, 
            COALESCE((
                SELECT COUNT(*)::int
                FROM template_categories tc
                JOIN templates t ON t.id = tc.template_id
                WHERE tc.category_slug = c.slug
                  AND tc.is_enabled = TRUE
            ), 0) as templates_number 
            FROM categories c WHERE c.slug = $1`, [slug]);
        return result.rows[0] || null;
    },
    async updateCategory(id, reqBody, slug, sort_order) {
        const result = await database_1.default.query(`UPDATE categories 
             SET name = $1, slug = $2, sort_order = $3, is_enabled = $4, localized_names = $5,
                 is_all_countries = $6, countries = $7
             WHERE id = $8 
             RETURNING *`, [
            reqBody.name,
            slug,
            sort_order,
            reqBody.is_enabled,
            reqBody.localized_names || null,
            reqBody.is_all_countries,
            reqBody.is_all_countries ? null : reqBody.countries || null,
            id
        ]);
        return result.rows[0];
    },
    async applyCategoryCountriesToTemplates(id) {
        const client = await database_1.default.connect();
        try {
            await client.query('BEGIN');
            const categoryResult = await client.query(`SELECT id, slug, is_all_countries, countries
                 FROM categories
                 WHERE id = $1
                 FOR UPDATE`, [id]);
            const category = categoryResult.rows[0];
            if (!category) {
                await client.query('ROLLBACK');
                return { updated: 0 };
            }
            const result = await client.query(`UPDATE templates t
                 SET is_all_countries = $1,
                     countries = $2
                 FROM template_categories tc
                 WHERE tc.template_id = t.id
                   AND tc.category_slug = $3`, [
                category.is_all_countries,
                category.is_all_countries ? null : category.countries || null,
                category.slug
            ]);
            await client.query('COMMIT');
            return { updated: result.rowCount || 0 };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    },
    updateOrderCategory: async (id, sort_order) => {
        const result = await database_1.default.query('UPDATE categories SET sort_order = $1 WHERE id = $2 RETURNING *', [sort_order, id]);
        return result.rows[0];
    },
    async deleteCategory(id) {
        const client = await database_1.default.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM categories WHERE id = $1', [id]);
            await client.query(`
                DELETE FROM templates 
                WHERE id NOT IN (SELECT DISTINCT template_id FROM template_categories)
            `);
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
};
