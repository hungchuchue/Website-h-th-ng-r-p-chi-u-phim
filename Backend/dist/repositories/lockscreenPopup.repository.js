"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockscreenPopupRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const templateEnabledSql = `EXISTS (
    SELECT 1
    FROM template_categories tc_enabled
    JOIN categories c_enabled ON c_enabled.slug = tc_enabled.category_slug
    WHERE tc_enabled.template_id = t.id
      AND tc_enabled.is_enabled = TRUE
      AND c_enabled.is_enabled = TRUE
)`;
const templateCountrySql = (paramIndex) => `(t.is_all_countries = true OR t.countries @> ARRAY[$${paramIndex}]::VARCHAR[])`;
const popupSelectSql = `
    lp.id,
    lp.mode,
    lp.status,
    lp.scheduled_date::text AS scheduled_date,
    lp.slot_time::text AS slot_time,
    lp.country_code,
    lp.title,
    lp.description,
    lp.created_at,
    lp.updated_at,
    t.id AS template_id,
    t.image_url,
    t.prompt,
    t.ratio,
    COALESCE(type_map.type_ids, ARRAY[]::int[]) AS type_ids,
    COALESCE(type_map.types, '[]'::jsonb) AS types,
    ${templateEnabledSql} AS is_enabled,
    t.is_all_countries,
    t.countries,
    t.created_at AS template_created_at
`;
const popupJoinsSql = `
    JOIN templates t ON t.id = lp.template_id
    LEFT JOIN LATERAL (
        SELECT
            array_agg(ttm.type_id ORDER BY ttm.type_id) AS type_ids,
            jsonb_agg(
                jsonb_build_object(
                    'id', tt.id,
                    'type_name', tt.type_name,
                    'description', tt.description,
                    'created_at', tt.created_at
                )
                ORDER BY ttm.type_id
            ) AS types
        FROM template_type_mappings ttm
        JOIN template_types tt ON tt.id = ttm.type_id
        WHERE ttm.template_id = t.id
    ) type_map ON TRUE
`;
const mapPopupRow = (row) => ({
    id: row.id,
    mode: row.mode,
    status: row.status,
    scheduled_date: row.scheduled_date,
    slot_time: row.slot_time,
    country_code: row.country_code,
    title: row.title,
    description: row.description,
    template_id: row.template_id,
    image_url: row.image_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
});
exports.lockscreenPopupRepository = {
    async getCurrentPopup(scheduledDate, slotTime, country) {
        const params = [scheduledDate, slotTime];
        const popupCountryWhere = country
            ? `AND (lp.country_code = $3 OR (lp.mode = 'manual' AND lp.country_code IS NULL))`
            : `AND lp.country_code IS NULL`;
        const templateCountryWhere = country ? `AND ${templateCountrySql(4)}` : '';
        if (country)
            params.push(country, country);
        const result = await database_1.default.query(`SELECT ${popupSelectSql}
             FROM lockscreen_popups lp
             ${popupJoinsSql}
             WHERE lp.scheduled_date = $1::date
               AND lp.slot_time = $2::time
               AND lp.status = 'active'
               ${popupCountryWhere}
               AND ${templateEnabledSql}
               ${templateCountryWhere}
             ORDER BY CASE WHEN lp.mode = 'manual' THEN 0 ELSE 1 END,
                      CASE WHEN lp.country_code IS NULL THEN 1 ELSE 0 END,
                      lp.updated_at DESC
             LIMIT 1`, params);
        return result.rows[0] ? mapPopupRow(result.rows[0]) : null;
    },
    async getConfiguredSlotTimes() {
        const result = await database_1.default.query(`SELECT DISTINCT slot_time::text AS slot_time
             FROM lockscreen_popup_slots
             WHERE is_enabled = TRUE
             ORDER BY slot_time ASC`);
        return result.rows.map((row) => row.slot_time);
    },
    async listSlots() {
        const result = await database_1.default.query(`SELECT id, slot_time::text AS slot_time, is_enabled, created_at, updated_at
             FROM lockscreen_popup_slots
             ORDER BY slot_time ASC`);
        return result.rows;
    },
    async createSlot(slotTime, isEnabled) {
        const result = await database_1.default.query(`INSERT INTO lockscreen_popup_slots (slot_time, is_enabled)
             VALUES ($1::time, $2)
             RETURNING id, slot_time::text AS slot_time, is_enabled, created_at, updated_at`, [slotTime, isEnabled]);
        return result.rows[0];
    },
    async updateSlot(id, values) {
        const fields = [];
        const params = [];
        if (values.slot_time !== undefined) {
            params.push(values.slot_time);
            fields.push(`slot_time = $${params.length}::time`);
        }
        if (values.is_enabled !== undefined) {
            params.push(values.is_enabled);
            fields.push(`is_enabled = $${params.length}`);
        }
        if (fields.length === 0) {
            return this.getSlotById(id);
        }
        params.push(id);
        const result = await database_1.default.query(`UPDATE lockscreen_popup_slots
             SET ${fields.join(', ')}, updated_at = NOW()
             WHERE id = $${params.length}
             RETURNING id, slot_time::text AS slot_time, is_enabled, created_at, updated_at`, params);
        return result.rows[0] || null;
    },
    async getSlotById(id) {
        const result = await database_1.default.query(`SELECT id, slot_time::text AS slot_time, is_enabled, created_at, updated_at
             FROM lockscreen_popup_slots
             WHERE id = $1`, [id]);
        return result.rows[0] || null;
    },
    async deleteSlot(id) {
        const result = await database_1.default.query(`DELETE FROM lockscreen_popup_slots WHERE id = $1`, [id]);
        return (result.rowCount || 0) > 0;
    },
    async listAutoTexts() {
        const result = await database_1.default.query(`SELECT id, title, description, is_enabled, created_at, updated_at
             FROM lockscreen_auto_texts
             ORDER BY created_at DESC`);
        return result.rows;
    },
    async createAutoText(title, description, isEnabled) {
        const result = await database_1.default.query(`INSERT INTO lockscreen_auto_texts (title, description, is_enabled)
             VALUES ($1::jsonb, $2::jsonb, $3)
             RETURNING id, title, description, is_enabled, created_at, updated_at`, [JSON.stringify(title), JSON.stringify(description), isEnabled]);
        return result.rows[0];
    },
    async updateAutoText(id, values) {
        const fields = [];
        const params = [];
        if (values.title !== undefined) {
            params.push(JSON.stringify(values.title));
            fields.push(`title = $${params.length}::jsonb`);
        }
        if (values.description !== undefined) {
            params.push(JSON.stringify(values.description));
            fields.push(`description = $${params.length}::jsonb`);
        }
        if (values.is_enabled !== undefined) {
            params.push(values.is_enabled);
            fields.push(`is_enabled = $${params.length}`);
        }
        if (fields.length === 0) {
            return this.getAutoTextById(id);
        }
        params.push(id);
        const result = await database_1.default.query(`UPDATE lockscreen_auto_texts
             SET ${fields.join(', ')}, updated_at = NOW()
             WHERE id = $${params.length}
             RETURNING id, title, description, is_enabled, created_at, updated_at`, params);
        return result.rows[0] || null;
    },
    async getAutoTextById(id) {
        const result = await database_1.default.query(`SELECT id, title, description, is_enabled, created_at, updated_at
             FROM lockscreen_auto_texts
             WHERE id = $1`, [id]);
        return result.rows[0] || null;
    },
    async deleteAutoText(id) {
        const result = await database_1.default.query(`DELETE FROM lockscreen_auto_texts WHERE id = $1`, [id]);
        return (result.rowCount || 0) > 0;
    },
    async getRandomAutoText() {
        const result = await database_1.default.query(`SELECT title, description
             FROM lockscreen_auto_texts
             WHERE is_enabled = TRUE
             ORDER BY random()
             LIMIT 1`);
        return result.rows[0] || null;
    },
    async listPopups(limit, offset, filters) {
        const params = [];
        const whereParts = ['1=1'];
        if (filters.scheduledDate) {
            params.push(filters.scheduledDate);
            whereParts.push(`lp.scheduled_date = $${params.length}::date`);
        }
        if (filters.mode) {
            params.push(filters.mode);
            whereParts.push(`lp.mode = $${params.length}`);
        }
        if (filters.status) {
            params.push(filters.status);
            whereParts.push(`lp.status = $${params.length}`);
        }
        if (filters.country) {
            if (filters.country === 'global') {
                whereParts.push(`lp.country_code IS NULL`);
            }
            else if (filters.country === 'all') {
                // no country filter: show all global and country-specific popups
            }
            else {
                params.push(filters.country);
                whereParts.push(`lp.country_code = $${params.length}`);
            }
        }
        const countParams = [...params];
        params.push(limit, offset);
        const whereSql = `WHERE ${whereParts.join(' AND ')}`;
        const [popupResult, countResult] = await Promise.all([
            database_1.default.query(`SELECT ${popupSelectSql}
                 FROM lockscreen_popups lp
                 ${popupJoinsSql}
                 ${whereSql}
                 ORDER BY lp.scheduled_date DESC, lp.slot_time DESC, CASE WHEN lp.mode = 'manual' THEN 0 ELSE 1 END
                 LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
            database_1.default.query(`SELECT COUNT(*) FROM lockscreen_popups lp ${whereSql}`, countParams)
        ]);
        return {
            popups: popupResult.rows.map(mapPopupRow),
            total: parseInt(countResult.rows[0].count, 10)
        };
    },
    async createPopup(reqBody) {
        const result = await database_1.default.query(`WITH inserted AS (
                INSERT INTO lockscreen_popups (mode, status, scheduled_date, slot_time, country_code, template_id, title, description)
                VALUES ($1, $2, $3::date, $4::time, $5, $6, $7::jsonb, $8::jsonb)
                RETURNING *
             )
             SELECT ${popupSelectSql}
             FROM inserted lp
             ${popupJoinsSql}`, [
            reqBody.mode,
            reqBody.status,
            reqBody.scheduled_date,
            reqBody.slot_time,
            reqBody.country_code,
            reqBody.template_id,
            JSON.stringify(reqBody.title),
            JSON.stringify(reqBody.description),
        ]);
        return mapPopupRow(result.rows[0]);
    },
    async updatePopup(id, reqBody) {
        const fields = [];
        const values = [];
        if (reqBody.status !== undefined) {
            values.push(reqBody.status);
            fields.push(`status = $${values.length}`);
        }
        if (reqBody.mode !== undefined) {
            values.push(reqBody.mode);
            fields.push(`mode = $${values.length}`);
        }
        if (reqBody.scheduled_date !== undefined) {
            values.push(reqBody.scheduled_date);
            fields.push(`scheduled_date = $${values.length}::date`);
        }
        if (reqBody.slot_time !== undefined) {
            values.push(reqBody.slot_time);
            fields.push(`slot_time = $${values.length}::time`);
        }
        if (reqBody.country_code !== undefined) {
            values.push(reqBody.country_code);
            fields.push(`country_code = $${values.length}`);
        }
        if (reqBody.template_id !== undefined) {
            values.push(reqBody.template_id);
            fields.push(`template_id = $${values.length}`);
        }
        if (reqBody.title !== undefined) {
            values.push(JSON.stringify(reqBody.title));
            fields.push(`title = $${values.length}::jsonb`);
        }
        if (reqBody.description !== undefined) {
            values.push(JSON.stringify(reqBody.description));
            fields.push(`description = $${values.length}::jsonb`);
        }
        if (fields.length === 0) {
            return this.getPopupById(id);
        }
        values.push(id);
        const result = await database_1.default.query(`WITH updated AS (
                UPDATE lockscreen_popups
                SET ${fields.join(', ')}, updated_at = NOW()
                WHERE id = $${values.length}
                RETURNING *
             )
             SELECT ${popupSelectSql}
             FROM updated lp
             ${popupJoinsSql}`, values);
        return result.rows[0] ? mapPopupRow(result.rows[0]) : null;
    },
    async getPopupById(id) {
        const result = await database_1.default.query(`SELECT ${popupSelectSql}
             FROM lockscreen_popups lp
             ${popupJoinsSql}
             WHERE lp.id = $1`, [id]);
        return result.rows[0] ? mapPopupRow(result.rows[0]) : null;
    },
    async deletePopup(id) {
        const result = await database_1.default.query(`DELETE FROM lockscreen_popups WHERE id = $1`, [id]);
        return (result.rowCount || 0) > 0;
    },
    async templateExists(templateId) {
        const result = await database_1.default.query(`SELECT 1 FROM templates WHERE id = $1 LIMIT 1`, [templateId]);
        return (result.rowCount || 0) > 0;
    },
    async pickRandomTemplateForAuto(scheduledDate, country) {
        const params = [scheduledDate, country || null];
        const countryWhere = country ? `AND ${templateCountrySql(3)}` : '';
        if (country)
            params.push(country);
        const unusedResult = await database_1.default.query(`SELECT t.id
             FROM templates t
             WHERE ${templateEnabledSql}
               ${countryWhere}
               AND NOT EXISTS (
                   SELECT 1
                   FROM lockscreen_popups lp_used
                   WHERE lp_used.scheduled_date = $1::date
                     AND lp_used.mode = 'auto'
                     AND lp_used.status = 'active'
                     AND lp_used.country_code IS NOT DISTINCT FROM $2::varchar
                     AND lp_used.template_id = t.id
               )
             ORDER BY random()
             LIMIT 1`, params);
        if (unusedResult.rows[0]) {
            return unusedResult.rows[0].id;
        }
        const fallbackParams = [];
        const fallbackCountryWhere = country ? `AND ${templateCountrySql(1)}` : '';
        if (country)
            fallbackParams.push(country);
        const fallbackResult = await database_1.default.query(`SELECT t.id
             FROM templates t
             WHERE ${templateEnabledSql}
               ${fallbackCountryWhere}
             ORDER BY random()
             LIMIT 1`, fallbackParams);
        return fallbackResult.rows[0]?.id || null;
    }
};
