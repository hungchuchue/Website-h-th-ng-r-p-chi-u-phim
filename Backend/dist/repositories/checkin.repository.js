"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkinRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const logger_1 = require("../utils/logger");
const CHECKIN_TEMPLATE_CYCLE_DAYS = 14;
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
const templateSelectSql = `
    t.id,
    t.image_url,
    t.prompt,
    t.ratio,
    COALESCE(type_map.type_ids, ARRAY[]::int[]) AS type_ids,
    COALESCE(type_map.types, '[]'::jsonb) AS types,
    cfg.is_enabled,
    t.is_all_countries,
    t.countries,
    t.created_at,
    cfg.country_code AS config_country_code,
    cfg.day_slot AS sort_order
`;
exports.checkinRepository = {
    findCheckinSpecialCategory: async () => {
        const result = await database_1.default.query(`SELECT c.*,
                    COALESCE((
                        SELECT COUNT(*)::int
                        FROM template_categories tc
                        WHERE tc.category_slug = c.slug
                          AND tc.is_enabled = TRUE
                    ), 0) AS templates_number
             FROM categories c
             WHERE c.is_checkin_special = TRUE
             LIMIT 1`);
        return result.rows[0] || null;
    },
    getCheckinCategoryStats: async (categorySlug) => {
        const result = await database_1.default.query(`SELECT
                COUNT(*)::int AS total,
                COUNT(DISTINCT tc.sort_order)::int AS distinct_sort_orders,
                COALESCE(MIN(tc.sort_order), 0)::int AS min_sort_order,
                COALESCE(MAX(tc.sort_order), 0)::int AS max_sort_order
             FROM template_categories tc
             WHERE tc.category_slug = $1
               AND tc.is_enabled = TRUE`, [categorySlug]);
        const stats = result.rows[0];
        return {
            total: Number(stats.total),
            distinctSortOrders: Number(stats.distinct_sort_orders),
            minSortOrder: Number(stats.min_sort_order),
            maxSortOrder: Number(stats.max_sort_order)
        };
    },
    setCheckinSpecialCategory: async (categoryId) => {
        const client = await database_1.default.connect();
        try {
            await client.query('BEGIN');
            const categoryResult = await client.query(`SELECT *
                 FROM categories
                 WHERE id = $1
                 FOR UPDATE`, [categoryId]);
            const category = categoryResult.rows[0];
            if (!category) {
                throw new logger_1.AppError(404, 'NOT_FOUND', 'Category not found');
            }
            const statsResult = await client.query(`SELECT
                    COUNT(*)::int AS total,
                    COUNT(DISTINCT tc.sort_order)::int AS distinct_sort_orders,
                    COALESCE(MIN(tc.sort_order), 0)::int AS min_sort_order,
                    COALESCE(MAX(tc.sort_order), 0)::int AS max_sort_order
                 FROM template_categories tc
                 WHERE tc.category_slug = $1
                   AND tc.is_enabled = TRUE`, [category.slug]);
            const stats = statsResult.rows[0];
            const total = Number(stats.total);
            const distinctSortOrders = Number(stats.distinct_sort_orders);
            const minSortOrder = Number(stats.min_sort_order);
            const maxSortOrder = Number(stats.max_sort_order);
            if (total < CHECKIN_TEMPLATE_CYCLE_DAYS) {
                throw new logger_1.AppError(400, 'INVALID_CHECKIN_CATEGORY', `Check-in category must contain at least ${CHECKIN_TEMPLATE_CYCLE_DAYS} enabled templates`);
            }
            if (minSortOrder !== 1 || maxSortOrder !== total || distinctSortOrders !== total) {
                throw new logger_1.AppError(400, 'INVALID_CHECKIN_CATEGORY', 'template_categories.sort_order must be continuous from 1 to N');
            }
            await client.query(`UPDATE categories SET is_checkin_special = FALSE WHERE is_checkin_special = TRUE`);
            const updatedResult = await client.query(`UPDATE categories
                 SET is_checkin_special = TRUE
                 WHERE id = $1
                 RETURNING *`, [categoryId]);
            await client.query('COMMIT');
            return updatedResult.rows[0];
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    },
    findUserByDevice: async (deviceId) => {
        const result = await database_1.default.query(`SELECT * FROM checkin_users WHERE device_id = $1`, [deviceId]);
        return result.rows[0] || null;
    },
    createUser: async (deviceId, countryCode) => {
        const result = await database_1.default.query(`INSERT INTO checkin_users (device_id, country_code, start_date)
             VALUES ($1, $2, CURRENT_DATE)
             ON CONFLICT (device_id) DO UPDATE
             SET updated_at = CURRENT_TIMESTAMP
             RETURNING *`, [deviceId, countryCode]);
        return result.rows[0];
    },
    updateUserCountry: async (deviceId, countryCode) => {
        const result = await database_1.default.query(`UPDATE checkin_users
             SET country_code = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE device_id = $1
             RETURNING *`, [deviceId, countryCode]);
        return result.rows[0];
    },
    getUserCategory: async (categoryId) => {
        const result = await database_1.default.query(`SELECT c.*,
                    COALESCE((
                        SELECT COUNT(*)::int
                        FROM template_categories tc
                        WHERE tc.category_slug = c.slug
                          AND tc.is_enabled = TRUE
                    ), 0) AS templates_number
             FROM categories c
             WHERE c.id = $1`, [categoryId]);
        return result.rows[0] || null;
    },
    getCurrentRawDay: async (userId) => {
        const result = await database_1.default.query(`SELECT
                GREATEST((CURRENT_DATE - start_date) + 1, 1)::int AS raw_day
             FROM checkin_users
             WHERE id = $1`, [userId]);
        return Number(result.rows[0].raw_day);
    },
    countUnlockedInWindow: async (userId, windowStart, windowEnd) => {
        const result = await database_1.default.query(`SELECT COUNT(*)::int AS total
             FROM checkin_logs
             WHERE user_id = $1
               AND day_number BETWEEN $2 AND $3`, [userId, windowStart, windowEnd]);
        return Number(result.rows[0].total);
    },
    findLogByDay: async (userId, rawDay) => {
        const result = await database_1.default.query(`SELECT * FROM checkin_logs WHERE user_id = $1 AND day_number = $2`, [userId, rawDay]);
        return result.rows[0] || null;
    },
    getCalendarDateForRawDay: async (userId, rawDay) => {
        const result = await database_1.default.query(`SELECT (start_date + ($2::int - 1))::date::text AS calendar_date
             FROM checkin_users
             WHERE id = $1`, [userId, rawDay]);
        return result.rows[0].calendar_date;
    },
    insertLog: async (userId, rawDay, calendarDate, unlockSource) => {
        const result = await database_1.default.query(`INSERT INTO checkin_logs (user_id, day_number, calendar_date, unlock_source)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, day_number) DO NOTHING
             RETURNING *`, [userId, rawDay, calendarDate, unlockSource]);
        return result.rows[0] || null;
    },
    getTemplateForRawDay: async (countryCode, userId, rawDay) => {
        const result = await database_1.default.query(`SELECT
                ${templateSelectSql},
                $2::int AS raw_day_number,
                ((($2::int - 1) % 7) + 1)::int AS day_number,
                (cl.id IS NOT NULL) AS unlocked,
                cl.unlock_source,
                cl.unlocked_at
             FROM checkin_template_configs cfg
             JOIN templates t ON t.id = cfg.template_id
             ${templateTypeJoinsSql}
             LEFT JOIN checkin_logs cl
               ON cl.user_id = $3
              AND cl.day_number = $2
             WHERE cfg.country_code IN ($1, 'all')
               AND cfg.is_enabled = TRUE
               AND cfg.day_slot = ((($2::int - 1) % ${CHECKIN_TEMPLATE_CYCLE_DAYS}) + 1)
             ORDER BY CASE WHEN cfg.country_code = $1 THEN 0 ELSE 1 END
             LIMIT 1`, [countryCode, rawDay, userId]);
        return result.rows[0] || null;
    },
    getWindowTemplates: async (countryCode, userId, windowStart) => {
        const result = await database_1.default.query(`WITH days AS (
                SELECT generate_series($2::int, ($2::int + 6))::int AS raw_day_number
             )
             SELECT
                selected.id,
                selected.image_url,
                selected.prompt,
                selected.ratio,
                selected.type_ids,
                selected.types,
                selected.is_enabled,
                selected.is_all_countries,
                selected.countries,
                selected.created_at,
                selected.config_country_code,
                selected.sort_order,
                d.raw_day_number,
                (((d.raw_day_number - 1) % 7) + 1)::int AS day_number,
                (cl.id IS NOT NULL) AS unlocked,
                cl.unlock_source,
                cl.unlocked_at
             FROM days d
             LEFT JOIN LATERAL (
                SELECT
                    ${templateSelectSql}
                FROM checkin_template_configs cfg
                JOIN templates t ON t.id = cfg.template_id
                ${templateTypeJoinsSql}
                WHERE cfg.country_code IN ($1, 'all')
                  AND cfg.is_enabled = TRUE
                  AND cfg.day_slot = (((d.raw_day_number - 1) % ${CHECKIN_TEMPLATE_CYCLE_DAYS}) + 1)
                ORDER BY CASE WHEN cfg.country_code = $1 THEN 0 ELSE 1 END
                LIMIT 1
             ) selected ON TRUE
             LEFT JOIN checkin_logs cl
               ON cl.user_id = $3
              AND cl.day_number = d.raw_day_number
             ORDER BY d.raw_day_number ASC`, [countryCode, windowStart, userId]);
        return result.rows;
    },
    setCheckinTemplateConfig: async (countryCode, daySlot, templateId, isEnabled) => {
        const result = await database_1.default.query(`INSERT INTO checkin_template_configs (country_code, day_slot, template_id, is_enabled)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (country_code, day_slot) DO UPDATE
             SET template_id = EXCLUDED.template_id,
                 is_enabled = EXCLUDED.is_enabled,
                 updated_at = CURRENT_TIMESTAMP
             RETURNING *`, [countryCode, daySlot, templateId, isEnabled]);
        return result.rows[0];
    },
    listCheckinTemplateConfigs: async (countryCode) => {
        const params = [];
        let whereSql = '';
        if (countryCode) {
            params.push(countryCode);
            whereSql = 'WHERE cfg.country_code = $1';
        }
        const result = await database_1.default.query(`SELECT
                cfg.*,
                t.image_url,
                t.prompt,
                t.ratio
             FROM checkin_template_configs cfg
             JOIN templates t ON t.id = cfg.template_id
             ${whereSql}
             ORDER BY cfg.country_code ASC, cfg.day_slot ASC`, params);
        return result.rows;
    }
};
