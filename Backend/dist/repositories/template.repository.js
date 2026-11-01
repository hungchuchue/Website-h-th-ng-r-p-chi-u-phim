"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const logger_1 = require("../utils/logger");
const ALL_CATEGORY_SLUG = 'all';
const SORT_ORDER_STEP = 1;
const CategorySlugs = (slugs) => {
    return Array.from(new Set(slugs
        .map((slug) => slug.trim())
        .filter(Boolean)));
};
const countryFilterSql = (paramIndex) => {
    return `(t.is_all_countries = true OR t.countries @> ARRAY[$${paramIndex}]::VARCHAR[])`;
};
const templateTypeJoinsSql = `
    LEFT JOIN LATERAL (
        SELECT
            array_agg(ttm.type_id ORDER BY ttm.type_id) AS type_ids,
            jsonb_agg(
                jsonb_build_object(
                    'id', tt_map.id,
                    'type_name', tt_map.type_name,
                    'description', tt_map.description,
                    'created_at', tt_map.created_at
                )
                ORDER BY ttm.type_id
            ) AS types
        FROM template_type_mappings ttm
        JOIN template_types tt_map ON tt_map.id = ttm.type_id
        WHERE ttm.template_id = t.id
    ) type_map ON TRUE
`;
const templateAnyCategoryEnabledSql = `EXISTS (
        SELECT 1
        FROM template_categories tc_enabled
        WHERE tc_enabled.template_id = t.id
          AND tc_enabled.is_enabled = TRUE
    )`;
const templateAnyVisibleCategoryEnabledSql = `EXISTS (
        SELECT 1
        FROM template_categories tc_enabled
        JOIN categories c_enabled ON c_enabled.slug = tc_enabled.category_slug
        WHERE tc_enabled.template_id = t.id
          AND tc_enabled.category_slug != '${ALL_CATEGORY_SLUG}'
          AND tc_enabled.is_enabled = TRUE
          AND c_enabled.is_enabled = TRUE
    )`;
const templateSelectFieldsSql = (enabledSql = templateAnyCategoryEnabledSql) => `
    t.id,
    t.image_url,
    t.prompt,
    t.ratio,
    COALESCE(type_map.type_ids, ARRAY[]::int[]) AS type_ids,
    COALESCE(type_map.types, '[]'::jsonb) AS types,
    ${enabledSql} AS is_enabled,
    t.is_all_countries,
    t.countries,
    t.created_at
`;
const typeFilterSql = (paramIndex) => {
    return `EXISTS (
        SELECT 1
        FROM template_type_mappings ttm_filter
        WHERE ttm_filter.template_id = t.id
          AND ttm_filter.type_id = $${paramIndex}::int
    )`;
};
const rebalanceCategorySortOrder = async (client, categorySlug, excludedTemplateId) => {
    await client.query(`WITH ordered AS (
            SELECT 
                template_id,
                ROW_NUMBER() OVER (ORDER BY sort_order ASC, template_id ASC) AS rn
            FROM template_categories
            WHERE category_slug = $1
              AND ($2::uuid IS NULL OR template_id != $2::uuid)
        )
        UPDATE template_categories tc
        SET sort_order = ordered.rn::int
        FROM ordered
        WHERE tc.template_id = ordered.template_id
          AND tc.category_slug = $1`, [categorySlug, excludedTemplateId || null]);
};
const resolveDefaultTemplateTypeId = async (client, defaultTypeName) => {
    const normalizedTypeName = defaultTypeName.trim();
    if (!normalizedTypeName) {
        throw new logger_1.AppError(400, 'INVALID_TEMPLATE_TYPE', 'Default template type is required');
    }
    const result = await client.query(`SELECT id FROM template_types WHERE type_name = $1`, [normalizedTypeName]);
    if (result.rowCount === 0) {
        throw new logger_1.AppError(400, 'INVALID_TEMPLATE_TYPE', `Template type '${normalizedTypeName}' not found`);
    }
    return result.rows[0].id;
};
const resolveTemplateTypeIds = async (client, typeIds, defaultTypeName) => {
    if (!Array.isArray(typeIds) || typeIds.length === 0) {
        if (!defaultTypeName) {
            throw new logger_1.AppError(400, 'INVALID_TEMPLATE_TYPE', 'type_ids must contain at least one template type');
        }
        return [await resolveDefaultTemplateTypeId(client, defaultTypeName)];
    }
    const parsedTypeIds = Array.from(new Set(typeIds.map((typeId) => {
        const parsed = Number(typeId);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            throw new logger_1.AppError(400, 'INVALID_TEMPLATE_TYPE', 'type_ids must contain positive integers');
        }
        return parsed;
    })));
    const result = await client.query(`SELECT id FROM template_types WHERE id = ANY($1::int[])`, [parsedTypeIds]);
    const foundIds = new Set(result.rows.map((row) => Number(row.id)));
    const missingIds = parsedTypeIds.filter((typeId) => !foundIds.has(typeId));
    if (missingIds.length > 0) {
        throw new logger_1.AppError(400, 'INVALID_TEMPLATE_TYPE', `Template type id '${missingIds.join(', ')}' not found`);
    }
    return parsedTypeIds;
};
const replaceTemplateTypes = async (client, templateId, typeIds) => {
    await client.query('DELETE FROM template_type_mappings WHERE template_id = $1', [templateId]);
    if (typeIds.length === 0)
        return;
    await client.query(`INSERT INTO template_type_mappings (template_id, type_id)
         SELECT $1::uuid, unnest($2::int[])
         ON CONFLICT DO NOTHING`, [templateId, typeIds]);
};
const enrichTemplateTypes = async (client, template) => {
    const result = await client.query(`SELECT
            COALESCE(array_agg(tt.id ORDER BY tt.id), ARRAY[]::int[]) AS type_ids,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', tt.id,
                        'type_name', tt.type_name,
                        'description', tt.description,
                        'created_at', tt.created_at
                    )
                    ORDER BY tt.id
                ),
                '[]'::jsonb
            ) AS types
         FROM template_type_mappings ttm
         JOIN template_types tt ON tt.id = ttm.type_id
         WHERE ttm.template_id = $1`, [template.id]);
    const typeIds = result.rows[0]?.type_ids || [];
    const types = result.rows[0]?.types || [];
    template.type_ids = typeIds;
    template.types = types;
    return template;
};
exports.templateRepository = {
    findTemplateTypes: async () => {
        const result = await database_1.default.query(`SELECT id, type_name, description, created_at
             FROM template_types
             ORDER BY id ASC`);
        return result.rows;
    },
    syncAllCategoryTemplates: async () => {
        const client = await database_1.default.connect();
        try {
            await client.query('BEGIN');
            await client.query(`SET LOCAL app.skip_template_sort_shift = 'on'`);
            const allCategoryResult = await client.query(`SELECT slug FROM categories WHERE slug = $1 FOR UPDATE`, [ALL_CATEGORY_SLUG]);
            if (allCategoryResult.rowCount === 0) {
                throw new logger_1.AppError(500, 'ALL_CATEGORY_NOT_FOUND', "Category 'all' not found");
            }
            const result = await client.query(`WITH source_templates AS (
                    SELECT DISTINCT ON (tc.template_id)
                        tc.template_id,
                        c.sort_order AS category_sort_order,
                        tc.sort_order AS template_sort_order,
                        t.created_at
                    FROM template_categories tc
                    JOIN categories c ON c.slug = tc.category_slug
                    JOIN templates t ON t.id = tc.template_id
                    WHERE tc.category_slug != $1
                      AND c.is_enabled = TRUE
                    ORDER BY
                        tc.template_id,
                        c.sort_order ASC,
                        tc.sort_order ASC,
                        t.created_at ASC
                ),
                ordered_templates AS (
                    SELECT
                        template_id,
                        ROW_NUMBER() OVER (
                            ORDER BY category_sort_order ASC, template_sort_order ASC, created_at ASC, template_id ASC
                        )::int AS next_sort_order
                    FROM source_templates
                ),
                deleted_stale AS (
                    DELETE FROM template_categories all_tc
                    WHERE all_tc.category_slug = $1
                      AND NOT EXISTS (SELECT 1 FROM ordered_templates ot WHERE ot.template_id = all_tc.template_id)
                    RETURNING all_tc.template_id
                ),
                upserted AS (
                    INSERT INTO template_categories (template_id, category_slug, sort_order, is_enabled)
                    SELECT
                        template_id,
                        $1,
                        next_sort_order,
                        TRUE
                    FROM ordered_templates
                    ON CONFLICT (template_id, category_slug) DO UPDATE
                    SET sort_order = EXCLUDED.sort_order
                    WHERE template_categories.sort_order IS DISTINCT FROM EXCLUDED.sort_order
                    RETURNING template_id
                )
                SELECT (
                    (SELECT COUNT(*) FROM deleted_stale) +
                    (SELECT COUNT(*) FROM upserted)
                )::int AS changed_count`, [ALL_CATEGORY_SLUG]);
            await client.query('COMMIT');
            return { inserted: parseInt(result.rows[0]?.changed_count || '0', 10) };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    },
    bulkReorderTemplates: async (category_slug, items) => {
        const client = await database_1.default.connect();
        try {
            await client.query('BEGIN');
            await client.query(`SET LOCAL app.skip_template_sort_shift = 'on'`);
            await client.query(`SELECT template_id
                 FROM template_categories
                 WHERE category_slug = $1
                 FOR UPDATE`, [category_slug]);
            const result = await client.query(`WITH ordered_input AS (
                    SELECT
                        template_id::uuid AS template_id,
                        sort_order::int AS next_sort_order
                    FROM jsonb_to_recordset($2::jsonb) AS input(template_id text, sort_order int)
                ),
                updated AS (
                    UPDATE template_categories tc
                    SET sort_order = ordered_input.next_sort_order
                    FROM ordered_input
                    WHERE tc.template_id = ordered_input.template_id
                      AND tc.category_slug = $1
                    RETURNING tc.template_id
                )
                SELECT template_id FROM updated`, [category_slug, JSON.stringify(items)]);
            if (result.rowCount !== items.length) {
                throw new logger_1.AppError(400, 'INVALID_INPUT', `All template_id values must belong to category '${category_slug}'`);
            }
            await rebalanceCategorySortOrder(client, category_slug);
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
    findAll: async (limit, offset, keyword, countryCode, onlyEnabled = true, type_id) => {
        const params = [limit, offset];
        const countParams = [];
        const whereParts = [];
        const countWhereParts = [];
        if (onlyEnabled) {
            whereParts.push(templateAnyCategoryEnabledSql);
            countWhereParts.push(templateAnyCategoryEnabledSql);
        }
        if (keyword) {
            params.push(`%${keyword}%`);
            whereParts.push(`(t.id::text ILIKE $${params.length} OR t.image_url ILIKE $${params.length})`);
            countParams.push(`%${keyword}%`);
            countWhereParts.push(`(t.id::text ILIKE $${countParams.length} OR t.image_url ILIKE $${countParams.length})`);
        }
        if (type_id) {
            params.push(type_id);
            whereParts.push(typeFilterSql(params.length));
            countParams.push(type_id);
            countWhereParts.push(typeFilterSql(countParams.length));
        }
        const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
        const countWhereSql = countWhereParts.length > 0 ? `WHERE ${countWhereParts.join(' AND ')}` : '';
        let countrySortSql = '';
        if (countryCode) {
            params.push(countryCode);
            countrySortSql = `CASE WHEN ${countryFilterSql(params.length)} THEN 0 ELSE 1 END ASC,`;
        }
        const templatesQuery = `
            SELECT 
                ${templateSelectFieldsSql()}, 
                (SELECT array_agg(category_slug) FROM template_categories WHERE template_id = t.id) as category_slugs
            FROM templates t
            ${templateTypeJoinsSql}
            ${whereSql}
            ORDER BY ${countrySortSql} t.created_at DESC
            LIMIT $1 OFFSET $2`;
        const countQuery = `SELECT COUNT(*) FROM templates t ${countWhereSql}`;
        const [templatesResult, countResult] = await Promise.all([
            database_1.default.query(templatesQuery, params),
            database_1.default.query(countQuery, countParams)
        ]);
        return {
            templates: templatesResult.rows,
            total: parseInt(countResult.rows[0].count, 10)
        };
    },
    findByCategorySlug: async (categorySlug, limit, offset, keyword, type, countryCode, onlyEnabled = true) => {
        const params = [categorySlug, limit, offset];
        const filters = [];
        if (onlyEnabled) {
            filters.push('tc.is_enabled = TRUE');
        }
        if (keyword) {
            params.push(`%${keyword}%`);
            filters.push(`(t.id::text ILIKE $${params.length} OR t.image_url ILIKE $${params.length})`);
        }
        if (type) {
            params.push(type);
            filters.push(typeFilterSql(params.length));
        }
        const filterSql = filters.length > 0 ? `AND ${filters.join(' AND ')}` : '';
        const countParams = [categorySlug, ...params.slice(3)];
        const countFilterSql = filterSql.replace(/\$(\d+)/g, (_match, index) => `$${Number(index) - 2}`);
        let countrySortSql = '';
        if (countryCode) {
            params.push(countryCode);
            countrySortSql = `CASE WHEN ${countryFilterSql(params.length)} THEN 0 ELSE 1 END ASC,`;
        }
        const templatesQuery = `
            SELECT 
                ${templateSelectFieldsSql('tc.is_enabled')}, 
                (SELECT array_agg(category_slug) FROM template_categories WHERE template_id = t.id) as category_slugs,
                tc.sort_order
            FROM templates t
            ${templateTypeJoinsSql}
            JOIN template_categories tc ON tc.template_id = t.id
            JOIN categories c ON c.slug = tc.category_slug
            WHERE tc.category_slug = $1
            ${filterSql}
            ORDER BY ${countrySortSql} tc.sort_order ASC
            LIMIT $2 OFFSET $3`;
        const countQuery = `
            SELECT COUNT(*)
            FROM template_categories tc
            JOIN templates t ON t.id = tc.template_id
            JOIN categories c ON c.slug = tc.category_slug
            WHERE tc.category_slug = $1
            ${countFilterSql}`;
        const [templatesResult, countResult] = await Promise.all([
            database_1.default.query(templatesQuery, params),
            database_1.default.query(countQuery, countParams)
        ]);
        return {
            templates: templatesResult.rows,
            total: parseInt(countResult.rows[0].count, 10)
        };
    },
    findByType: async (id, limit, offset, countryCode, onlyEnabled = true) => {
        const params = [id, limit, offset];
        const filters = [];
        if (onlyEnabled) {
            filters.push(templateAnyVisibleCategoryEnabledSql);
        }
        const filterSql = filters.length > 0 ? `AND ${filters.join(' AND ')}` : '';
        const countParams = [id, ...params.slice(3)];
        const countFilterSql = filterSql.replace(/\$(\d+)/g, (_match, index) => `$${Number(index) - 2}`);
        let countrySortSql = '';
        if (countryCode) {
            params.push(countryCode);
            countrySortSql = `CASE WHEN ${countryFilterSql(params.length)} THEN 0 ELSE 1 END ASC,`;
        }
        const templatesQuery = `
            SELECT 
                ${templateSelectFieldsSql()}, 
                (SELECT array_agg(category_slug) FROM template_categories WHERE template_id = t.id) as category_slugs
            FROM templates t
            ${templateTypeJoinsSql}
            WHERE ${typeFilterSql(1)}
            ${filterSql}
            ORDER BY ${countrySortSql} t.created_at DESC
            LIMIT $2 OFFSET $3`;
        const countQuery = `
            SELECT COUNT(*)
            FROM templates t
            WHERE ${typeFilterSql(1)}
            ${countFilterSql}`;
        const [templatesResult, countResult] = await Promise.all([
            database_1.default.query(templatesQuery, params),
            database_1.default.query(countQuery, countParams)
        ]);
        return {
            templates: templatesResult.rows,
            total: parseInt(countResult.rows[0].count, 10)
        };
    },
    findById: async (id) => {
        const result = await database_1.default.query(`SELECT
                ${templateSelectFieldsSql()},
                (SELECT array_agg(category_slug) FROM template_categories WHERE template_id = t.id) as category_slugs
             FROM templates t
             ${templateTypeJoinsSql}
             WHERE t.id = $1`, [id]);
        return result.rows[0] || null;
    },
    findRandomTemplateByCategory: async (categorySlug) => {
        const result = await database_1.default.query(`SELECT
                ${templateSelectFieldsSql('tc.is_enabled')},
                (SELECT array_agg(category_slug) FROM template_categories WHERE template_id = t.id) as category_slugs,
                tc.sort_order
             FROM templates t
             ${templateTypeJoinsSql}
             JOIN template_categories tc ON tc.template_id = t.id
             WHERE tc.category_slug = $1
               AND tc.is_enabled = TRUE
             ORDER BY random()
             LIMIT 1`, [categorySlug]);
        return result.rows[0] || null;
    },
    createTemplate: async (reqBody) => {
        const client = await database_1.default.connect();
        try {
            await client.query('BEGIN');
            const categorySlugs = CategorySlugs(reqBody.category_slugs || []);
            const typeIds = await resolveTemplateTypeIds(client, reqBody.type_ids, 'swap_face');
            const templateResult = await client.query(`INSERT INTO templates (image_url, prompt, ratio, is_all_countries, countries) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`, [
                reqBody.image_url,
                reqBody.prompt,
                reqBody.ratio,
                reqBody.is_all_countries,
                reqBody.countries || null
            ]);
            const template = templateResult.rows[0];
            await replaceTemplateTypes(client, template.id, typeIds);
            if (categorySlugs.length > 0) {
                for (const slug of categorySlugs) {
                    await client.query(`UPDATE template_categories
                         SET sort_order = sort_order + $2
                         WHERE category_slug = $1`, [slug, SORT_ORDER_STEP]);
                    await client.query(`INSERT INTO template_categories (template_id, category_slug, sort_order)
                         VALUES ($1, $2, $3)
                         ON CONFLICT DO NOTHING`, [template.id, slug, SORT_ORDER_STEP]);
                }
            }
            template.category_slugs = categorySlugs;
            await enrichTemplateTypes(client, template);
            await client.query('COMMIT');
            return template;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    },
    addTemplatesToCategory: async (template_ids, category_slug) => {
        const client = await database_1.default.connect();
        try {
            await client.query('BEGIN');
            for (const id of template_ids) {
                const maxSortResult = await client.query(`SELECT COALESCE(MAX(sort_order), 0) + $2 AS next_sort 
                     FROM template_categories 
                     WHERE category_slug = $1`, [category_slug, SORT_ORDER_STEP]);
                const nextSort = parseInt(maxSortResult.rows[0].next_sort, 10);
                await client.query(`INSERT INTO template_categories (template_id, category_slug, sort_order)
                     VALUES ($1, $2, $3)
                     ON CONFLICT DO NOTHING`, [id, category_slug, nextSort]);
            }
            const result = await client.query(`SELECT
                ${templateSelectFieldsSql()}
                 FROM templates t
                 ${templateTypeJoinsSql}
                 WHERE t.id = ANY($1)`, [template_ids]);
            const templates = result.rows;
            const enrichPromises = templates.map(async (template) => {
                const categoryResult = await client.query(`SELECT array_agg(category_slug) as category_slugs 
                     FROM template_categories 
                     WHERE template_id = $1`, [template.id]);
                template.category_slugs = categoryResult.rows[0]?.category_slugs || [];
                return template;
            });
            const finalTemplates = await Promise.all(enrichPromises);
            await client.query('COMMIT');
            return finalTemplates;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    },
    updateTemplate: async (id, reqBody) => {
        const client = await database_1.default.connect();
        try {
            await client.query('BEGIN');
            let updatedTemplate = null;
            let requestedTypeIds;
            if (reqBody.image_url ||
                reqBody.prompt ||
                reqBody.ratio !== undefined ||
                reqBody.type_ids !== undefined ||
                reqBody.is_all_countries !== undefined ||
                reqBody.countries !== undefined) {
                const fields = [];
                const values = [];
                let idx = 1;
                if (reqBody.image_url) {
                    fields.push(`image_url = $${idx++}`);
                    values.push(reqBody.image_url);
                }
                if (reqBody.prompt) {
                    fields.push(`prompt = $${idx++}`);
                    values.push(reqBody.prompt);
                }
                if (reqBody.ratio !== undefined) {
                    fields.push(`ratio = $${idx++}`);
                    values.push(reqBody.ratio);
                }
                if (reqBody.type_ids !== undefined) {
                    requestedTypeIds = await resolveTemplateTypeIds(client, reqBody.type_ids);
                }
                if (reqBody.is_all_countries !== undefined) {
                    fields.push(`is_all_countries = $${idx++}`);
                    values.push(reqBody.is_all_countries);
                }
                if (reqBody.countries !== undefined) {
                    fields.push(`countries = $${idx++}`);
                    values.push(reqBody.countries);
                }
                values.push(id);
                const result = await client.query(fields.length > 0
                    ? `UPDATE templates SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`
                    : `SELECT * FROM templates WHERE id = $${idx}`, values);
                updatedTemplate = result.rows[0];
            }
            else {
                const result = await client.query(`SELECT * FROM templates WHERE id = $1`, [id]);
                updatedTemplate = result.rows[0];
            }
            if (requestedTypeIds !== undefined) {
                await replaceTemplateTypes(client, id, requestedTypeIds);
            }
            if (reqBody.category_slugs) {
                const requestedCategorySlugs = CategorySlugs(reqBody.category_slugs);
                const existingCategoryResult = await client.query(`SELECT category_slug, sort_order, is_enabled
                     FROM template_categories
                     WHERE template_id = $1
                     FOR UPDATE`, [id]);
                const existingSortBySlug = new Map(existingCategoryResult.rows.map((row) => [row.category_slug, Number(row.sort_order)]));
                const existingEnabledBySlug = new Map(existingCategoryResult.rows.map((row) => [row.category_slug, row.is_enabled === true]));
                const existingSlugs = existingCategoryResult.rows.map((row) => row.category_slug);
                const removedSlugs = existingSlugs.filter((slug) => !requestedCategorySlugs.includes(slug));
                await client.query(`SET LOCAL app.skip_template_sort_shift = 'on'`);
                await client.query('DELETE FROM template_categories WHERE template_id = $1', [id]);
                for (const slug of requestedCategorySlugs) {
                    let nextSort = existingSortBySlug.get(slug);
                    if (!existingSortBySlug.has(slug)) {
                        const maxSortResult = await client.query(`SELECT COALESCE(MAX(sort_order), 0) + $2 AS next_sort 
                             FROM template_categories 
                             WHERE category_slug = $1`, [slug, SORT_ORDER_STEP]);
                        nextSort = Number(maxSortResult.rows[0].next_sort);
                    }
                    await client.query(`INSERT INTO template_categories (template_id, category_slug, sort_order, is_enabled)
                         VALUES ($1, $2, $3, $4)`, [updatedTemplate.id, slug, nextSort, existingEnabledBySlug.get(slug) ?? true]);
                }
                for (const slug of removedSlugs) {
                    await rebalanceCategorySortOrder(client, slug);
                }
                updatedTemplate.category_slugs = requestedCategorySlugs;
            }
            else {
                const result = await client.query(`SELECT array_agg(category_slug) as category_slugs FROM template_categories WHERE template_id = $1`, [id]);
                updatedTemplate.category_slugs = result.rows[0]?.category_slugs || [];
            }
            await enrichTemplateTypes(client, updatedTemplate);
            await client.query('COMMIT');
            return updatedTemplate;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    },
    updateOrderTemplate: async (id, category_slug, sort_order) => {
        const client = await database_1.default.connect();
        try {
            await client.query('BEGIN');
            await client.query(`SET LOCAL app.skip_template_sort_shift = 'on'`);
            await client.query(`SELECT template_id
                 FROM template_categories
                 WHERE category_slug = $1
                 FOR UPDATE`, [category_slug]);
            const currentResult = await client.query(`SELECT template_id
                 FROM template_categories
                 WHERE template_id = $1 AND category_slug = $2
                 FOR UPDATE`, [id, category_slug]);
            if (currentResult.rowCount === 0) {
                throw new logger_1.AppError(404, 'NOT_FOUND', 'Template not found in category');
            }
            const countResult = await client.query(`SELECT COUNT(*) AS count
                 FROM template_categories
                 WHERE category_slug = $1
                   AND template_id != $2`, [category_slug, id]);
            const itemCountWithoutCurrent = parseInt(countResult.rows[0].count, 10);
            const targetPosition = Math.max(1, Math.min(Math.trunc(sort_order), itemCountWithoutCurrent + 1));
            await client.query(`WITH ordered_without_current AS (
                    SELECT
                        template_id,
                        ROW_NUMBER() OVER (ORDER BY sort_order ASC, template_id ASC)::int AS rn
                    FROM template_categories
                    WHERE category_slug = $1
                      AND template_id != $2
                ),
                positioned AS (
                    SELECT
                        template_id,
                        CASE WHEN rn >= $3 THEN rn + 1 ELSE rn END AS next_sort_order
                    FROM ordered_without_current
                    UNION ALL
                    SELECT $2::uuid AS template_id, $3::int AS next_sort_order
                )
                UPDATE template_categories tc
                SET sort_order = positioned.next_sort_order
                FROM positioned
                WHERE tc.template_id = positioned.template_id
                  AND tc.category_slug = $1`, [category_slug, id, targetPosition]);
            const result = await client.query(`SELECT 
                    ${templateSelectFieldsSql('moved.is_enabled')},
                    moved.sort_order,
                    (SELECT array_agg(category_slug ORDER BY category_slug) FROM template_categories WHERE template_id = t.id) AS category_slugs
                 FROM templates t
                 JOIN template_categories moved
                   ON moved.template_id = t.id
                  AND moved.category_slug = $2
                 ${templateTypeJoinsSql}
                 WHERE t.id = $1
                 `, [id, category_slug]);
            await client.query('COMMIT');
            return result.rows[0];
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    },
    updateTemplateCategoryVisibility: async (id, category_slug, is_enabled) => {
        const client = await database_1.default.connect();
        try {
            await client.query('BEGIN');
            const updatedMapping = await client.query(`UPDATE template_categories
                 SET is_enabled = $3
                 WHERE template_id = $1
                   AND category_slug = $2
                 RETURNING template_id`, [id, category_slug, is_enabled]);
            if (updatedMapping.rowCount === 0) {
                throw new logger_1.AppError(404, 'NOT_FOUND', 'Template not found in category');
            }
            const result = await client.query(`SELECT
                    ${templateSelectFieldsSql('tc.is_enabled')},
                    tc.sort_order,
                    (SELECT array_agg(category_slug ORDER BY category_slug) FROM template_categories WHERE template_id = t.id) AS category_slugs
                 FROM templates t
                 JOIN template_categories tc
                   ON tc.template_id = t.id
                  AND tc.category_slug = $2
                 ${templateTypeJoinsSql}
                 WHERE t.id = $1`, [id, category_slug]);
            await enrichTemplateTypes(client, result.rows[0]);
            await client.query('COMMIT');
            return result.rows[0];
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    },
    removeFromCategory: async (id, category_slug) => {
        const client = await database_1.default.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM template_categories WHERE template_id = $1 AND category_slug = $2', [id, category_slug]);
            await rebalanceCategorySortOrder(client, category_slug);
            const result = await client.query(`SELECT
                    ${templateSelectFieldsSql()}
                 FROM templates t
                 ${templateTypeJoinsSql}
                 WHERE t.id = $1`, [id]);
            const template = result.rows[0];
            const categoryResult = await client.query('SELECT array_agg(category_slug) as category_slugs FROM template_categories WHERE template_id = $1', [id]);
            template.category_slugs = categoryResult.rows[0]?.category_slugs || [];
            await client.query('COMMIT');
            return template;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    },
    deleteTemplate: async (id) => {
        const client = await database_1.default.connect();
        try {
            await client.query('BEGIN');
            const categoryResult = await client.query('SELECT category_slug FROM template_categories WHERE template_id = $1', [id]);
            await client.query('DELETE FROM templates WHERE id = $1', [id]);
            for (const row of categoryResult.rows) {
                await rebalanceCategorySortOrder(client, row.category_slug);
            }
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
