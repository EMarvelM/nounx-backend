const mysql = require('mysql2/promise');

let pool = null;

/**
 * Get a connection pool to the ERP Mirror database (read-only).
 * This connects to the NOUN ERP local mirror which contains
 * student records, study centres, programmes, etc.
 */
const getPool = () => {
    if (!pool) {
        const url = process.env.ERP_MIRROR_DB_URL;
        if (!url) {
            throw new Error('ERP_MIRROR_DB_URL environment variable is not set');
        }
        pool = mysql.createPool(url);
    }
    return pool;
};

/**
 * Look up a student by matric number.
 * Returns: full_name, programme, study_centre, level
 */
const lookupByMatric = async (matric) => {
    const db = getPool();
    const [rows] = await db.query(
        `SELECT 
            s.vMatricNo AS matric,
            CONCAT(s.vlastname, ' ', s.vothernames) AS full_name,
            p.vProgaward AS programme,
            c.vcityname AS study_centre,
            s.iYrLevel AS level
        FROM students s
        JOIN programme p ON p.cProgrammeID = s.cProgrammeID
        JOIN studycenter c ON c.cStudyCenterId = s.cStudyCenterId
        WHERE s.vMatricNo = ?
        LIMIT 1`,
        [matric]
    );
    return rows.length > 0 ? rows[0] : null;
};

/**
 * Search students by full name (lastname + othernames).
 * Returns array of masked matric numbers for the student to identify theirs.
 */
const lookupByName = async (name) => {
    const db = getPool();
    const searchTerm = `%${name.trim()}%`; // Add wildcards for LIKE search

    const [rows] = await db.query(
        `SELECT 
            s.vMatricNo AS matric,
            CONCAT(s.vlastname, ' ', s.vothernames) AS full_name,
            p.vProgaward AS programme
        FROM students s
        JOIN programme p ON p.cProgrammeID = s.cProgrammeID
        WHERE CONCAT(s.vlastname, ' ', s.vothernames) LIKE ?
           OR CONCAT(s.vothernames, ' ', s.vlastname) LIKE ?
        LIMIT 20`,
        [searchTerm, searchTerm]
    );
    return rows;
};

/**
 * Mask a matric number: show first 4 and last 4, hide the middle.
 * Example: NOU233403330 → NOU2****3330
 */
const maskMatric = (matric) => {
    if (!matric || matric.length < 8) return '****';
    const prefix = matric.substring(0, 4);
    const suffix = matric.substring(matric.length - 4);
    const masked = '*'.repeat(matric.length - 8);
    return `${prefix}${masked}${suffix}`;
};

module.exports = {
    getPool,
    lookupByMatric,
    lookupByName,
    maskMatric,
};
